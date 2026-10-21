// Runs the real migrations in PGlite against a minimal stub of Supabase's
// auth schema and checks the RLS rules that matter most for this family.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

const DAD = '00000000-0000-0000-0000-00000000000d'
const MOM = '00000000-0000-0000-0000-00000000000a'
const KID = '00000000-0000-0000-0000-00000000000c'
const STRANGER = '00000000-0000-0000-0000-0000000000ff'

const SUPABASE_STUB = `
  create schema auth;
  create schema extensions;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`

let db: PGlite

async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  await db.exec(uid ? 'set role authenticated' : 'set role anon')
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } })
  await db.exec(SUPABASE_STUB)
  const dir = join(__dirname, '..', 'migrations')
  for (const f of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'))
  }
  await db.exec(`insert into auth.users values
    ('${DAD}', 'jeremy@example.com'), ('${MOM}', 'amanda@example.com'),
    ('${KID}', 'kid@family-trainer.invalid'), ('${STRANGER}', 'stranger@example.com')`)
})

describe('household bootstrap and invites', () => {
  it('first sign-in creates the household with that user as admin', async () => {
    const [r] = await as<{ j: { status: string; role: string } }>(DAD, `select public.join_household('Jeremy') j`)
    expect(r.j).toEqual({ status: 'created', role: 'admin' })
  })

  it('an uninvited user is turned away', async () => {
    const [r] = await as<{ j: { status: string } }>(STRANGER, `select public.join_household() j`)
    expect(r.j.status).toBe('not_invited')
    expect(await as(STRANGER, 'select * from public.members')).toHaveLength(0)
  })

  it('only the admin can invite, and the invitee joins as adult', async () => {
    await expect(as(STRANGER, `select public.invite_member('x@example.com')`)).rejects.toThrow(/admin/)
    await as(DAD, `select public.invite_member('Amanda@Example.com', 'Amanda')`)
    const [r] = await as<{ j: { status: string; role: string } }>(MOM, `select public.join_household() j`)
    expect(r.j).toEqual({ status: 'joined', role: 'adult' })
    const [m] = await as<{ display_name: string }>(MOM, `select display_name from public.members where id = $1`, [MOM])
    expect(m.display_name).toBe('Amanda')
  })

  it('a member cannot promote themselves', async () => {
    await as(MOM, `update public.members set role = 'admin' where id = $1`, [MOM])
    const [m] = await as<{ role: string }>(MOM, `select role from public.members where id = $1`, [MOM])
    expect(m.role).toBe('adult')
  })
})

describe('child account', () => {
  beforeAll(async () => {
    // What the create-child edge function does with the service role.
    const hh = (await db.query<{ household_id: string }>(`select household_id from public.members where id = $1`, [DAD])).rows[0]
    await db.query(
      `insert into public.members (id, household_id, role, display_name, guardian_id) values ($1, $2, 'child', 'Son', $3)`,
      [KID, hh.household_id, DAD],
    )
    await db.query(`insert into public.member_private (member_id, weight_lb, height_in, age_years) values ($1, 105, 60, 12)`, [KID])
    await db.query(`insert into public.member_settings (member_id, feed_body) values ($1, true)`, [KID])
    await db.query(`insert into public.child_guardian_settings (child_id) values ($1)`, [KID])
    await db.query(`update public.member_private set weight_lb = 210 where member_id = $1`, [DAD])
  })

  it('the child can never read body weight, including his own', async () => {
    expect(await as(KID, 'select * from public.member_private')).toHaveLength(0)
    expect(await as(KID, 'select * from public.child_guardian_settings')).toHaveLength(0)
  })

  it('the child cannot write his own private row either', async () => {
    await expect(
      as(KID, `insert into public.member_private (member_id, weight_lb) values ($1, 90) on conflict (member_id) do update set weight_lb = 90`, [KID]),
    ).rejects.toThrow()
  })

  it('the guardian sees the child weight; mom does not see dad or the child', async () => {
    const dad = await as<{ member_id: string }>(DAD, 'select member_id from public.member_private order by member_id')
    expect(dad.map((r) => r.member_id).sort()).toEqual([KID, DAD].sort())
    const mom = await as<{ member_id: string }>(MOM, 'select member_id from public.member_private')
    expect(mom.map((r) => r.member_id)).toEqual([MOM])
  })

  it('the child cannot read other members settings', async () => {
    const rows = await as<{ member_id: string }>(KID, 'select member_id from public.member_settings')
    expect(rows.map((r) => r.member_id)).toEqual([KID])
  })

  it('body measurements never post to the feed from the child account', async () => {
    const [s] = await db.query<{ feed_body: boolean }>(`select feed_body from public.member_settings where member_id = $1`, [KID]).then((r) => r.rows)
    expect(s.feed_body).toBe(false)
    await as(DAD, `update public.member_settings set feed_body = true where member_id = $1`, [KID])
    const [s2] = await db.query<{ feed_body: boolean }>(`select feed_body from public.member_settings where member_id = $1`, [KID]).then((r) => r.rows)
    expect(s2.feed_body).toBe(false)
  })

  it('only the guardian can create a pairing code', async () => {
    await expect(as(MOM, `select public.create_pairing_code($1)`, [KID])).rejects.toThrow(/not your child/)
    await expect(as(KID, `select public.create_pairing_code($1)`, [KID])).rejects.toThrow(/not your child/)
    const [r] = await as<{ j: { code: string } }>(DAD, `select public.create_pairing_code($1) j`, [KID])
    expect(r.j.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    // A new code revokes the old one; clients can't read the table at all.
    await as(DAD, `select public.create_pairing_code($1)`, [KID])
    expect((await db.query(`select * from public.pairing_codes where used_at is null`)).rows).toHaveLength(1)
    expect(await as(DAD, 'select * from public.pairing_codes')).toHaveLength(0)
  })
})

describe('push subscriptions', () => {
  it('members only see and write their own', async () => {
    await as(DAD, `insert into public.push_subscriptions (member_id, endpoint, p256dh, auth) values ($1, 'https://push/1', 'k', 'a')`, [DAD])
    await expect(
      as(MOM, `insert into public.push_subscriptions (member_id, endpoint, p256dh, auth) values ($1, 'https://push/2', 'k', 'a')`, [DAD]),
    ).rejects.toThrow()
    expect(await as(MOM, 'select * from public.push_subscriptions')).toHaveLength(0)
    expect(await as(DAD, 'select * from public.push_subscriptions')).toHaveLength(1)
  })

  it('anonymous users see nothing', async () => {
    expect(await as(null, 'select * from public.members')).toHaveLength(0)
    expect(await as(null, 'select * from public.member_private')).toHaveLength(0)
  })
})
