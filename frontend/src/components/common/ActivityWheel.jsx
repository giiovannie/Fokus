const point = (angle, radius) => ({ x: 200 + radius * Math.sin(angle * Math.PI / 180), y: 200 - radius * Math.cos(angle * Math.PI / 180) })

export const ActivityWheel = ({ options, rotation, duration, onFinish }) => (
  <div className="roulette-stage">
    <span className="roulette-pointer" aria-hidden="true" />
    <div className="roulette-disc" style={{ transform: `rotate(${rotation}deg)`, transitionDuration: duration + 'ms' }} onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform') onFinish() }}>
      <svg viewBox="0 0 400 400" aria-hidden="true">
        {options.map((option, index) => {
          const angle = 360 / options.length, start = point(index * angle, 190), end = point((index + 1) * angle, 190)
          const text = point((index + 0.5) * angle, 135)
          const color = `hsl(${index * 137.508 % 360} 65% 28%)`
          return <g key={option.key}>
            {options.length === 1 ? <circle cx="200" cy="200" r="190" fill={color} /> : <path d={`M 200 200 L ${start.x} ${start.y} A 190 190 0 ${angle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`} fill={color} stroke="var(--bg-card)" strokeWidth="2" />}
            {options.length <= 36 && <text x={text.x} y={text.y} fill="white" textAnchor="middle" dominantBaseline="middle" fontSize={options.length > 18 ? 11 : 16} fontWeight="700">{index + 1}
              {options.length <= 8 && <tspan x={text.x} dy="19" fontSize="11">{option.label.length > 13 ? option.label.slice(0, 12) + '…' : option.label}</tspan>}
            </text>}
          </g>
        })}
        <circle cx="200" cy="200" r="35" fill="var(--bg-card)" />
        <text x="200" y="202" textAnchor="middle" dominantBaseline="middle" fontSize="25" fontWeight="800" fill="var(--color-primary)">F</text>
      </svg>
    </div>
  </div>
)
