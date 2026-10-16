import { useEffect, useState } from 'react'
import { toISODate } from '../../../shared/nextAction'

// Today's date (YYYY-MM-DD), refreshed every minute so lists move on at midnight.
export function useToday(): string {
  const [today, setToday] = useState(() => toISODate(new Date()))
  useEffect(() => {
    const timer = setInterval(() => setToday(toISODate(new Date())), 60_000)
    return () => clearInterval(timer)
  }, [])
  return today
}
