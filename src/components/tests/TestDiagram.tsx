import type { ReactElement } from 'react'
import type { TestId } from '../../lib/agility'

/** Simple top-down setup sketch: cones, lanes, and where the phone goes. */
export function TestDiagram({ test }: { test: TestId }) {
  const cone = (x: number, y: number, label?: string) => (
    <g key={`${x}-${y}`}>
      <path d={`M${x - 7},${y + 7} L${x},${y - 9} L${x + 7},${y + 7} Z`} className="cone" />
      {label && (
        <text x={x} y={y + 22} textAnchor="middle" className="dlabel">
          {label}
        </text>
      )}
    </g>
  )
  const phone = (x: number, y: number) => (
    <g>
      <rect x={x - 9} y={y - 14} width={18} height={28} rx={4} className="phone" />
      <text x={x} y={y + 30} textAnchor="middle" className="dlabel">
        📱 phone
      </text>
    </g>
  )
  const athlete = (x: number, y: number) => <circle cx={x} cy={y} r={7} className="athlete" />

  let body: ReactElement
  switch (test) {
    case 'vertical':
      body = (
        <>
          <line x1={20} x2={300} y1={110} y2={110} className="lane" />
          {athlete(110, 100)}
          <path d="M110,88 V40" className="arrow" />
          {phone(230, 96)}
          <text x={110} y={30} textAnchor="middle" className="dlabel">
            jump straight up
          </text>
        </>
      )
      break
    case 'broad':
      body = (
        <>
          <line x1={60} x2={60} y1={40} y2={120} className="lane" />
          {athlete(48, 80)}
          <path d="M60,80 H200" className="arrow" />
          <text x={130} y={70} textAnchor="middle" className="dlabel">
            tape from line to heel
          </text>
          {phone(130, 140)}
        </>
      )
      break
    case 'sprint10':
    case 'dash40':
      body = (
        <>
          <line x1={20} x2={300} y1={70} y2={70} className="lane" />
          {cone(30, 60, 'start')}
          {test === 'dash40' ? cone(100, 60, '10 yd') : null}
          {cone(test === 'dash40' ? 290 : 250, 60, test === 'dash40' ? '40 yd' : '10 yd')}
          {athlete(52, 70)}
          {phone(test === 'dash40' ? 160 : 250, 130)}
        </>
      )
      break
    case 'pro_agility':
      body = (
        <>
          {[70, 160, 250].map((x) => (
            <line key={x} x1={x} x2={x} y1={40} y2={100} className="lane" />
          ))}
          <text x={115} y={34} textAnchor="middle" className="dlabel">
            5 yd
          </text>
          <text x={205} y={34} textAnchor="middle" className="dlabel">
            5 yd
          </text>
          {athlete(160, 70)}
          {phone(160, 140)}
        </>
      )
      break
    case 'three_cone':
      body = (
        <>
          {cone(60, 110, '1 / start')}
          {cone(200, 110, '2')}
          {cone(200, 40, '3')}
          <path d="M60,100 H190 M190,100 H70 M70,100 Q200,140 205,105 Q215,50 200,50 Q170,40 200,30 Q240,40 200,95 L70,105" className="route" />
          {phone(290, 80)}
        </>
      )
      break
  }
  return (
    <svg viewBox="0 0 320 170" className="test-diagram" role="img" aria-label="Setup diagram">
      {body}
    </svg>
  )
}
