export function QualifierLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      role="img"
      aria-label="State meet command mark"
    >
      <rect width="48" height="48" rx="10" fill="#0f2a47" />
      <path
        d="M11 32c6.8-9.1 16-10.9 27.5-5.4"
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <path
        d="M11 25c7-7.8 16.2-9 27.3-3.8"
        fill="none"
        stroke="#69b7a4"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <path
        d="M11 18c7.3-6.5 16.3-7.3 26.8-2.3"
        fill="none"
        stroke="#f2c14e"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <path
        d="M33.5 13.5v21"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="2.6"
      />
      <path
        d="M38 15.5v17"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeWidth="2.6"
        opacity="0.72"
      />
      <circle cx="16" cy="30.8" r="3" fill="#f2c14e" />
    </svg>
  );
}

export function StateMeetBlueprintSvg({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 620 330"
      className={className}
      role="img"
      aria-label="State meet scoring and cutoff command board"
    >
      <rect width="620" height="330" rx="18" fill="#f8fbfd" />
      <path d="M0 96h620" stroke="#d8e2ea" />
      <path d="M415 0v330" stroke="#d8e2ea" />
      <rect x="28" y="26" width="148" height="16" rx="8" fill="#0f2a47" />
      <rect x="28" y="56" width="98" height="10" rx="5" fill="#d8e2ea" />
      <rect x="138" y="56" width="70" height="10" rx="5" fill="#d8e2ea" />
      <rect x="438" y="26" width="56" height="10" rx="5" fill="#69b7a4" />
      <rect x="508" y="26" width="62" height="10" rx="5" fill="#f2c14e" />

      <g transform="translate(34 128)">
        <rect x="0" y="0" width="342" height="152" rx="76" fill="#edf4f7" />
        <rect
          x="18"
          y="18"
          width="306"
          height="116"
          rx="58"
          fill="none"
          stroke="#0f2a47"
          strokeWidth="8"
        />
        <rect
          x="36"
          y="36"
          width="270"
          height="80"
          rx="40"
          fill="none"
          stroke="#69b7a4"
          strokeWidth="5"
        />
        <rect
          x="54"
          y="54"
          width="234"
          height="44"
          rx="22"
          fill="#ffffff"
          stroke="#d8e2ea"
          strokeWidth="3"
        />
        <path
          d="M247 25v101M261 25v101M275 30v91"
          stroke="#f2c14e"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <circle cx="74" cy="38" r="7" fill="#0f2a47" />
        <circle cx="106" cy="25" r="7" fill="#69b7a4" />
        <circle cx="146" cy="24" r="7" fill="#f2c14e" />
        <path
          d="M70 119c37-20 77-22 120-8 27 9 55 11 84 3"
          fill="none"
          stroke="#0f2a47"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </g>

      <g transform="translate(438 66)">
        {[0, 1, 2, 3].map((index) => (
          <g key={index} transform={`translate(0 ${index * 42})`}>
            <rect width="132" height="24" rx="7" fill="#ffffff" />
            <rect
              x="12"
              y="8"
              width={48 + index * 14}
              height="8"
              rx="4"
              fill={index === 0 ? "#0f2a47" : index === 1 ? "#69b7a4" : "#f2c14e"}
            />
            <path
              d="M104 7v10"
              stroke="#d8e2ea"
              strokeLinecap="round"
              strokeWidth="3"
            />
            <path
              d="M116 7v10"
              stroke="#d8e2ea"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </g>
        ))}
      </g>

      <g transform="translate(438 246)">
        <rect width="132" height="50" rx="10" fill="#ffffff" />
        <path
          d="M14 35c21-20 38-24 52-12 15 12 31 7 51-15"
          fill="none"
          stroke="#0f2a47"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="M50 9v32"
          stroke="#f2c14e"
          strokeDasharray="4 5"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <circle cx="50" cy="24" r="6" fill="#f2c14e" />
      </g>
    </svg>
  );
}

export function PointMixTrackSvg({
  relayPct,
  className = "",
}: {
  relayPct: number;
  className?: string;
}) {
  const individualPct = Math.max(0, 100 - relayPct);

  return (
    <svg
      viewBox="0 0 180 150"
      className={className}
      role="img"
      aria-label={`Point mix, ${relayPct}% relay and ${individualPct}% individual`}
    >
      <rect width="180" height="150" rx="16" fill="#f8fbfd" />
      <ellipse
        cx="90"
        cy="75"
        rx="62"
        ry="43"
        fill="none"
        stroke="#e1eaf0"
        strokeWidth="18"
      />
      <ellipse
        cx="90"
        cy="75"
        rx="62"
        ry="43"
        pathLength="100"
        fill="none"
        stroke="#69b7a4"
        strokeDasharray={`${individualPct} ${relayPct}`}
        strokeDashoffset="25"
        strokeLinecap="round"
        strokeWidth="18"
      />
      <ellipse
        cx="90"
        cy="75"
        rx="62"
        ry="43"
        pathLength="100"
        fill="none"
        stroke="#0f2a47"
        strokeDasharray={`${relayPct} ${individualPct}`}
        strokeDashoffset={`${25 - individualPct}`}
        strokeLinecap="round"
        strokeWidth="18"
      />
      <ellipse cx="90" cy="75" rx="38" ry="24" fill="#ffffff" />
      <path
        d="M125 42v66M134 47v56"
        stroke="#f2c14e"
        strokeLinecap="round"
        strokeWidth="3.4"
      />
      <path
        d="m51 103 22-16 15 12 24-31"
        fill="none"
        stroke="#0f2a47"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <circle cx="73" cy="87" r="4.5" fill="#69b7a4" />
      <circle cx="112" cy="68" r="4.5" fill="#f2c14e" />
    </svg>
  );
}

export function OddsStepsSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 210 72"
      className={className}
      role="img"
      aria-label="Odds near the last state spot"
    >
      <rect width="210" height="72" rx="14" fill="#f8fbfd" />
      <path d="M18 52h174" stroke="#d8e2ea" strokeLinecap="round" strokeWidth="3" />
      {[24, 54, 84, 114, 144, 174].map((x, index) => (
        <g key={x}>
          <rect
            x={x}
            y={47 - index * 5}
            width="16"
            height={10 + index * 5}
            rx="4"
            fill={index < 2 ? "#cbd5e1" : index < 4 ? "#f2c14e" : "#69b7a4"}
          />
          <circle
            cx={x + 8}
            cy={21 + Math.max(0, 4 - index) * 3}
            r={index >= 4 ? 5 : 3.5}
            fill={index >= 4 ? "#0f2a47" : "#d8e2ea"}
          />
        </g>
      ))}
      <path
        d="M22 45c24-16 44-18 61-7 18 12 35 8 52-8 16-15 34-18 54-7"
        fill="none"
        stroke="#0f2a47"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      <path d="M132 16v42" stroke="#f2c14e" strokeDasharray="4 5" strokeWidth="3" />
    </svg>
  );
}

export function HistoricalTrendSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 210 72"
      className={className}
      role="img"
      aria-label="Historical cutoff trend"
    >
      <rect width="210" height="72" rx="14" fill="#f8fbfd" />
      <path d="M18 55h174M18 35h174M18 15h174" stroke="#d8e2ea" strokeLinecap="round" />
      <path
        d="M24 49c21-12 38-11 52 3 17 17 36 12 56-15 17-23 35-27 55-8"
        fill="none"
        stroke="#69b7a4"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <path
        d="M25 32c23 12 43 10 61-4 26-20 57-14 92 18"
        fill="none"
        stroke="#0f2a47"
        strokeLinecap="round"
        strokeWidth="3.5"
      />
      <circle cx="132" cy="37" r="6" fill="#f2c14e" />
      <circle cx="187" cy="29" r="6" fill="#0f2a47" />
    </svg>
  );
}

export function LateWaveSvg({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 210 72"
      className={className}
      role="img"
      aria-label="Late qualifying wave"
    >
      <rect width="210" height="72" rx="14" fill="#f8fbfd" />
      <path d="M18 55h174" stroke="#d8e2ea" strokeLinecap="round" strokeWidth="3" />
      <path
        d="M20 48c14 0 14-18 28-18s14 18 28 18 14-18 28-18 14 18 28 18 14-18 28-18 14 18 28 18"
        fill="none"
        stroke="#0f2a47"
        strokeLinecap="round"
        strokeWidth="4"
      />
      <path
        d="M130 14v42"
        stroke="#f2c14e"
        strokeDasharray="4 5"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <circle cx="130" cy="30" r="7" fill="#f2c14e" />
      <path d="m155 23 25 8-25 8z" fill="#69b7a4" />
      <path d="M33 18h46" stroke="#d8e2ea" strokeLinecap="round" strokeWidth="5" />
    </svg>
  );
}
