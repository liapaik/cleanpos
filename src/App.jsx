import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './screens/Login'
import Nav from './components/Nav'
import NewOrder from './screens/NewOrder'
import Orders from './screens/Orders'
import Customers from './screens/Customers'
import Pricing from './screens/Pricing'
import Reports from './screens/Reports'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('new-order')
  const [holdCount, setHoldCount] = useState(0)
  const [resumeOrder, setResumeOrder] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchHoldCount()
  }, [session])

  const fetchHoldCount = async () => {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('is_held', true)
    setHoldCount(count ?? 0)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-400 text-lg">Loading...</div>
      </div>
    )

  if (!session) return <Login />

  const handleResumeOrder = (orderData) => {
    setResumeOrder(orderData)
    setActiveTab('new-order')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Nav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        holdCount={holdCount}
      />
      <main className="pt-16 h-screen">
        <div className={activeTab === 'new-order' ? 'block h-full' : 'hidden'}>
          <NewOrder
            holdCount={holdCount}
            resumeOrder={resumeOrder}
            setResumeOrder={setResumeOrder}
            onHoldCountChange={fetchHoldCount}
          />
        </div>
        <div className={activeTab === 'orders' ? 'block' : 'hidden'}>
          <Orders
            holdCount={holdCount}
            onResumeOrder={handleResumeOrder}
            onHoldCountChange={fetchHoldCount}
            isActive={activeTab === 'orders'}
          />
        </div>
        <div className={activeTab === 'customers' ? 'block' : 'hidden'}>
          <Customers isActive={activeTab === 'customers'} />
        </div>
        <div className={activeTab === 'pricing' ? 'block' : 'hidden'}>
          <Pricing isActive={activeTab === 'pricing'} />
        </div>
        <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
          <Reports isActive={activeTab === 'reports'} />
        </div>
      </main>
    </div>
  )
}
