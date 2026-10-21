import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { PushBanner } from './components/PushBanner'
import { isIOS, isStandalone } from './lib/platform'
import { getPushState, syncPushSubscription } from './lib/push'
import { useSession } from './lib/session'
import { isConfigured } from './lib/api'
import { Admin } from './screens/Admin'
import { AddChild } from './screens/AddChild'
import { ChildDetail } from './screens/ChildDetail'
import { Home } from './screens/Home'
import { InstallGuide } from './screens/InstallGuide'
import { NotificationsSetup } from './screens/NotificationsSetup'
import { Settings } from './screens/Settings'
import { SignIn } from './screens/SignIn'
import { Message } from './components/Message'
import { startNutrition } from './lib/nutritionStore'
import { Log } from './screens/nutrition/Log'
import { MealEditor } from './screens/nutrition/MealEditor'
import { TargetsSetup } from './screens/nutrition/TargetsSetup'

const SKIP_INSTALL_KEY = 'ft:skip-install'
const PUSH_ONBOARDED_KEY = 'ft:push-onboarded'

function read(key: string) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function write(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {
    /* private mode: fine, we'll just ask again */
  }
}

export default function App() {
  const { status, error, member, signOut } = useSession()
  const location = useLocation()
  const [skipInstall, setSkipInstall] = useState(() => read(SKIP_INSTALL_KEY))
  const [pushOnboarded, setPushOnboarded] = useState(() => read(PUSH_ONBOARDED_KEY))

  useEffect(() => {
    if (member) startNutrition(member.id)
  }, [member])

  useEffect(() => {
    if (status !== 'ready') return
    syncPushSubscription()
    // Someone who already allowed notifications doesn't need the intro.
    getPushState().then((s) => {
      if (s === 'subscribed') {
        write(PUSH_ONBOARDED_KEY)
        setPushOnboarded(true)
      }
    })
  }, [status])

  if (!isConfigured) {
    return (
      <Message title="Not configured yet">
        Set <code>VITE_API_URL</code> to the Apps Script web app address. See docs/SETUP.md.
      </Message>
    )
  }

  // On iPhone, push only works from the home-screen app, so install comes first.
  if (isIOS() && !isStandalone() && !skipInstall) {
    return (
      <InstallGuide
        onSkip={() => {
          write(SKIP_INSTALL_KEY)
          setSkipInstall(true)
        }}
      />
    )
  }

  switch (status) {
    case 'loading':
      return <Message title="Loading…" />
    case 'signed-out':
      return <SignIn />
    case 'error':
      return (
        <Message title="Couldn't load your account" action={{ label: 'Sign out', onClick: signOut }}>
          {error}
        </Message>
      )
  }

  if (!pushOnboarded) {
    return (
      <NotificationsSetup
        onDone={() => {
          write(PUSH_ONBOARDED_KEY)
          setPushOnboarded(true)
        }}
      />
    )
  }

  return (
    <div className="app">
      <PushBanner />
      <main className="content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/log" element={<Log />} />
          <Route path="/meal/new" element={<MealEditor key={location.search} />} />
          <Route path="/meal/:id" element={<MealEditor />} />
          {member?.role !== 'child' && <Route path="/targets" element={<TargetsSetup />} />}
          {member?.role === 'admin' && (
            <>
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/add-child" element={<AddChild />} />
              <Route path="/admin/child/:id" element={<ChildDetail />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}
