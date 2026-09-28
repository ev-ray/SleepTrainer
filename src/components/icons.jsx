const I = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
)

export const Moon = (p) => <I {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></I>
export const Sun = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
  </I>
)
export const Heart = (p) => <I {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></I>
export const Home = (p) => <I {...p}><path d="M4 11l8-6.5 8 6.5V20H4z" /><path d="M10 20v-5h4v5" /></I>
export const List = (p) => <I {...p}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r=".6" fill="currentColor" /><circle cx="4" cy="12" r=".6" fill="currentColor" /><circle cx="4" cy="18" r=".6" fill="currentColor" /></I>
export const Chart = (p) => <I {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></I>
export const Book = (p) => <I {...p}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></I>
export const Check = (p) => <I stroke-width="2.6" {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></I>
export const Zzz = (p) => <I {...p}><path d="M4 8h6l-6 8h6M14 4h6l-6 8h6" /></I>
export const Eye = (p) => <I {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>
export const Bottle = (p) => <I {...p}><path d="M10 2h4M10.5 2v3L8 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2.5-3V2" /><path d="M8 12h8" /></I>
export const Bed = (p) => <I {...p}><path d="M3 18V6M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5" /><circle cx="7" cy="11" r="2" /></I>
export const Alert = (p) => <I {...p}><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" /></I>
export const Info = (p) => <I {...p}><circle cx="12" cy="12" r="9.5" /><path d="M12 11v6M12 7.5v.01" /></I>
export const Down = (p) => <I stroke-width="2.4" {...p}><path d="M12 5v14M6 13l6 6 6-6" /></I>
export const Up = (p) => <I stroke-width="2.4" {...p}><path d="M12 19V5M6 11l6-6 6 6" /></I>
export const Plus = (p) => <I {...p}><path d="M12 5v14M5 12h14" /></I>
export const Stop = (p) => <I {...p}><circle cx="12" cy="12" r="9.5" /><path d="M9 9h6v6H9z" /></I>
export const Leaf = (p) => <I {...p}><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" /><path d="M5 19l7-7" /></I>
export const Pencil = (p) => <I {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></I>
export const Chevron = (p) => <I stroke-width="2.4" {...p}><path d="M6 9l6 6 6-6" /></I>
export const Gear = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </I>
)
