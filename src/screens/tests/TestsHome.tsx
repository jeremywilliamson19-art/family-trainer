import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DailyBars } from '../../components/nutrition/DailyBars'
import { api } from '../../lib/api'
import { better, formatResult, TESTS, type TestDef } from '../../lib/agility'
import { useMember } from '../../lib/session'
import { mutateTraining, useTraining } from '../../lib/trainingStore'
import type { Member, TestRecord } from '../../lib/types'
import { drillName } from './TestFlow'

/** Everyone's filmed speed & jump tests: bests, change, history, form notes. */
export function TestsHome() {
  const me = useMember()
  const [params, setParams] = useSearchParams()
  const who = params.get('who') ?? me.id
  const forOther = who !== me.id
  const own = useTraining()
  const [members, setMembers] = useState<Member[]>([])
  const [records, setRecords] = useState<TestRecord[]>([])
  const [open, setOpen] = useState<string | null>(null)
  const savedId = params.get('saved')

  useEffect(() => {
    if (me.role === 'admin') api<Member[]>('listMembers').then((m) => setMembers(m.filter((x) => x.id === me.id || x.guardian_id === me.id)), () => {})
  }, [me])

  useEffect(() => {
    if (!forOther) setRecords(own.tests.filter((t) => t.member_id === me.id))
    else api<{ tests: TestRecord[] }>('trainingSync', { member_id: who, from: '9999-01-01' }).then((r) => setRecords(r.tests), () => {})
  }, [forOther, who, own.tests, me.id])

  useEffect(() => {
    const saved = records.find((r) => r.id === savedId)
    if (saved) setOpen(saved.test)
  }, [records, savedId])

  const remove = async (r: TestRecord) => {
    if (!confirm('Delete this result?')) return
    if (forOther) {
      await api('deleteTest', { id: r.id })
      setRecords(records.filter((x) => x.id !== r.id))
    } else mutateTraining({ type: 'deleteTest', id: r.id })
  }

  return (
    <div className="screen">
      <h1>Speed &amp; jump tests</h1>
      {members.length > 1 && (
        <div className="segmented">
          {members.map((m) => (
            <button key={m.id} className={who === m.id ? 'on' : ''} onClick={() => setParams({ who: m.id }, { replace: true })}>
              {m.id === me.id ? 'Me' : m.display_name}
            </button>
          ))}
        </div>
      )}
      <p className="muted small">Film in Slo-mo, pick the clip, tap the key frames. Retest every 4 weeks or so.</p>

      {TESTS.map((t) => (
        <TestCard key={t.id} test={t} records={records.filter((r) => r.test === t.id).sort((a, b) => a.date.localeCompare(b.date))} who={who} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} onDelete={remove} />
      ))}
    </div>
  )
}

function TestCard({ test, records, who, open, onToggle, onDelete }: { test: TestDef; records: TestRecord[]; who: string; open: boolean; onToggle: () => void; onDelete: (r: TestRecord) => void }) {
  const last = records[records.length - 1]
  const prev = records[records.length - 2]
  const best = records.length ? records.reduce((a, b) => (better(test, b.value, a.value) ? b : a)) : null
  const delta = last && prev ? last.value - prev.value : null
  const improved = delta !== null && delta !== 0 && better(test, last.value, prev.value)

  return (
    <section className="card stack">
      <button className="row test-head" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>{test.name}</strong>
          <small className="muted block">
            {last ? `Last ${formatResult(test, last.value)} · ${new Date(`${last.date}T12:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Not tested yet'}
          </small>
        </span>
        <span className="nums">
          {best && <strong>🏆 {formatResult(test, best.value)}</strong>}
          {delta !== null && delta !== 0 && (
            <small className={`block ${improved ? 'ok' : 'warn-text'}`}>
              {improved ? '▲' : '▼'} {test.unit === 's' ? `${Math.abs(delta).toFixed(2)} s` : `${Math.abs(delta).toFixed(1)}″`} {improved ? 'better' : 'slower'}
            </small>
          )}
        </span>
      </button>

      {open && (
        <>
          {records.length > 1 && (
            <DailyBars data={records.map((r) => ({ date: r.date, value: r.value }))} target={null} unit={test.unit === 's' ? 's' : 'in'} label={test.name} />
          )}
          {[...records].reverse().map((r) => (
            <div key={r.id} className="test-record">
              {r.thumbnail && <img src={r.thumbnail} alt="" />}
              <div>
                <strong>{formatResult(test, r.value)}</strong>
                {r.mph ? <small className="muted"> · {r.mph.toFixed(1)} mph</small> : null}
                {r.split10 ? <small className="muted"> · 10-yd split {r.split10.toFixed(2)} s</small> : null}
                <small className="muted block">
                  {new Date(`${r.date}T12:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {r.capture_fps ? ` · ${r.capture_fps} fps` : ''}
                </small>
                {r.findings.map((f) => (
                  <small key={f.id} className="block">
                    {f.kind === 'good' ? '✅' : f.kind === 'note' ? 'ℹ️' : '🎯'} {f.title}
                  </small>
                ))}
                {r.drills.length > 0 && <small className="muted block">Drills: {r.drills.map(drillName).join(', ')}</small>}
                <button className="btn link small" onClick={() => onDelete(r)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <Link to={`/tests/new/${test.id}?who=${who}`} className="btn secondary">
        {records.length ? 'Test again' : 'Record a test'}
      </Link>
    </section>
  )
}
