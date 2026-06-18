import { useRef, useState } from 'react'
import './ShareCard.css'

interface ShareCardProps {
  /** The pre-rendered, copy-pasteable result block (from buildShareCard). */
  text: string
}

/** Shows the series result as a copy-pasteable block with a one-tap copy button. */
export function ShareCard({ text }: ShareCardProps) {
  const [copied, setCopied] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  const copy = async () => {
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      // Fallback for insecure contexts / older browsers: select the hidden textarea and exec copy.
      const area = areaRef.current
      if (area) {
        area.focus()
        area.select()
        ok = document.execCommand('copy')
      }
    }
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="share-card">
      <div className="share-card-label">Share the result</div>
      <pre className="share-card-text">{text}</pre>
      <button className="btn-ghost share-card-copy" onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy result'}
      </button>
      <textarea ref={areaRef} className="share-card-fallback" readOnly value={text} aria-hidden tabIndex={-1} />
    </div>
  )
}
