'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import TopNav from '@/components/TopNav'
import RewardSuccess from '@/components/RewardSuccess'

function SuccessInner() {
  const params = useSearchParams()
  const earned = Number(params.get('earned')) || 0
  const points = Number(params.get('points')) || earned
  const source = params.get('source')

  const subtext =
    source === 'sos'
      ? `Your area is on our demand map. You earned +${earned} points for the report.`
      : source === 'feedback'
      ? `Thanks for sharing your thoughts. You earned +${earned} points for your feedback.`
      : `You earned +${earned} points.`

  return (
    <>
      <TopNav />
      <RewardSuccess earned={earned} currentPoints={points} headline="🎉 Thanks for helping MadMix!" subtext={subtext} />
    </>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <SuccessInner />
    </Suspense>
  )
}
