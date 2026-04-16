import React, { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { supabase } from './supabase'

// ─── THEME (matches GrailAdmin) ───────────────────────────────────────────────
const C = {
  bg:       '#080808',
  surface:  '#111',
  card:     '#141414',
  border:   '#1c1c1c',
  gold:     '#c8922a',
  goldLight:'#e8b84b',
  green:    '#22c55e',
  greenDim: '#14532d',
  red:      '#ef4444',
  text:     '#e8e0d0',
  textMid:  '#9a8878',
  textDim:  '#3a3028',
}

const btn = {
  base: {
    border: 'none', borderRadius: '8px', padding: '0.55rem 1.2rem',
    fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
  },
  gold: { background: C.gold, color: '#000' },
  ghost: { background: 'transparent', border: `1px solid ${C.border}`, color: C.textMid },
  danger: { background: 'transparent', border: `1px solid ${C.red}44`, color: C.red },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function detectColumns(headers) {
  const h = headers.map(s => s.toLowerCase().trim())
  const emailCol = headers[h.findIndex(s => s.includes('email'))] || null
  const nameCol  = headers[h.findIndex(s => s.includes('name') || s.includes('first'))] || null
  return { emailCol, nameCol }
}

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim())
}

// ─── UPLOAD ZONE ──────────────────────────────────────────────────────────────
function DropZone({ onFile }) {
  const [over, setOver] = useState(false)
  const inputRef = useRef()

  const handle = file => {
    if (!file || !file.name.endsWith('.csv')) return
    onFile(file)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]) }}
      onClick={() => inputRef.current.click()}
      style={{
        border: `2px dashed ${over ? C.gold : C.border}`,
        borderRadius: '14px',
        padding: '3rem 2rem',
        textAlign: 'center',
        cursor: 'pointer',
        background: over ? '#1a1400' : C.card,
        transition: 'all 0.15s',
      }}
    >
      <input ref={inputRef} type="file" accept=".csv" style={{ display: 'none' }}
        onChange={e => handle(e.target.files[0])} />
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
      <div style={{ color: C.text, fontWeight: '700', marginBottom: '0.3rem' }}>
        Drop a CSV here or click to browse
      </div>
      <div style={{ color: C.textMid, fontSize: '0.82rem' }}>
        Needs at least an <strong style={{ color: C.goldLight }}>email</strong> column.
        Name column optional.
      </div>
    </div>
  )
}

// ─── PREVIEW TABLE ─────────────────────────────────────────────────────────────
function PreviewTable({ rows, emailCol, nameCol }) {
  const preview = rows.slice(0, 6)
  return (
    <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
            {nameCol  && <th style={th}>Name</th>}
            <th style={th}>Email</th>
          </tr>
        </thead>
        <tbody>
          {preview.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              {nameCol  && <td style={td}>{row[nameCol]  || '—'}</td>}
              <td style={{ ...td, color: isValidEmail(row[emailCol]) ? C.text : C.red }}>
                {row[emailCol] || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 6 && (
        <div style={{ padding: '0.5rem 1rem', color: C.textMid, fontSize: '0.78rem', background: C.surface }}>
          +{rows.length - 6} more rows
        </div>
      )}
    </div>
  )
}

const th = { padding: '0.6rem 1rem', textAlign: 'left', color: C.textMid, fontWeight: '600' }
const td = { padding: '0.55rem 1rem', color: C.text }

// ─── CONTACTS LIST ─────────────────────────────────────────────────────────────
function ContactsList({ contacts, onDelete }) {
  const [search, setSearch] = useState('')
  const filtered = contacts.filter(c =>
    c.email.includes(search) || (c.name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts..."
          style={{
            flex: 1, background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '8px', padding: '0.55rem 0.9rem',
            fontSize: '0.85rem', color: C.text, outline: 'none',
          }}
        />
        <div style={{ color: C.textMid, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
          {contacts.length.toLocaleString()} contacts
        </div>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
              <th style={th}>Email</th>
              <th style={th}>Name</th>
              <th style={{ ...th, textAlign: 'right' }}>Added</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 100).map(c => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={td}>{c.email}</td>
                <td style={{ ...td, color: C.textMid }}>{c.name || '—'}</td>
                <td style={{ ...td, color: C.textMid, textAlign: 'right', fontSize: '0.78rem' }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: C.textMid, padding: '2rem' }}>No results</td></tr>
            )}
          </tbody>
        </table>
        {filtered.length > 100 && (
          <div style={{ padding: '0.5rem 1rem', color: C.textMid, fontSize: '0.78rem', background: C.surface }}>
            Showing 100 of {filtered.length} — refine your search to see more
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function GrailContacts({ promoterId }) {
  const [contacts,  setContacts]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [screen,    setScreen]    = useState('list')   // list | preview | importing
  const [parsed,    setParsed]    = useState(null)     // { rows, emailCol, nameCol, valid, dupes }
  const [importRes, setImportRes] = useState(null)     // { added, skipped }
  const [error,     setError]     = useState(null)

  const pid = promoterId || 'demo'

  // ── load contacts ────────────────────────────────────────────────────────────
  async function loadContacts() {
    setLoading(true)
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('promoter_id', pid)
      .order('created_at', { ascending: false })
    if (!error) setContacts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadContacts() }, [pid])

  // ── parse CSV ────────────────────────────────────────────────────────────────
  function handleFile(file) {
    setError(null)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const { emailCol, nameCol } = detectColumns(meta.fields || [])
        if (!emailCol) { setError('No email column found. Add a column named "email".'); return }

        const existingEmails = new Set(contacts.map(c => c.email.toLowerCase()))
        const valid  = data.filter(r => isValidEmail(r[emailCol]))
        const dupes  = valid.filter(r => existingEmails.has(r[emailCol].toLowerCase().trim()))
        const net    = valid.filter(r => !existingEmails.has(r[emailCol].toLowerCase().trim()))

        setParsed({ rows: data, valid, net, dupes, emailCol, nameCol })
        setScreen('preview')
      },
    })
  }

  // ── import ───────────────────────────────────────────────────────────────────
  async function runImport() {
    if (!parsed) return
    setScreen('importing')

    const rows = parsed.net.map(r => ({
      promoter_id: pid,
      email: r[parsed.emailCol].toLowerCase().trim(),
      name:  parsed.nameCol ? (r[parsed.nameCol] || '').trim() || null : null,
    }))

    // Batch in chunks of 500
    let added = 0
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500)
      const { error } = await supabase
        .from('contacts')
        .upsert(chunk, { onConflict: 'promoter_id,email', ignoreDuplicates: true })
      if (error) { setError(error.message); setScreen('preview'); return }
      added += chunk.length
    }

    setImportRes({ added, skipped: parsed.dupes.length })
    await loadContacts()
    setScreen('done')
  }

  // ── UI ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ color: C.text, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: '760px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontWeight: '800', fontSize: '1.15rem', marginBottom: '0.2rem' }}>Mailing List</div>
          <div style={{ color: C.textMid, fontSize: '0.82rem' }}>
            {loading ? 'Loading…' : `${contacts.length.toLocaleString()} contacts`}
          </div>
        </div>
        {screen === 'list' && (
          <button
            onClick={() => { setScreen('upload'); setError(null) }}
            style={{ ...btn.base, ...btn.gold }}
          >
            + Import CSV
          </button>
        )}
        {(screen === 'upload' || screen === 'preview' || screen === 'done') && (
          <button
            onClick={() => { setScreen('list'); setParsed(null); setImportRes(null); setError(null) }}
            style={{ ...btn.base, ...btn.ghost }}
          >
            ← Back to list
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: '#1a0000', border: `1px solid ${C.red}44`, borderRadius: '8px', padding: '0.8rem 1rem', marginBottom: '1rem', color: C.red, fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {screen === 'list' && (
        <>
          {loading ? (
            <div style={{ color: C.textMid, padding: '3rem', textAlign: 'center' }}>Loading…</div>
          ) : contacts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
              <div style={{ fontWeight: '700', marginBottom: '0.4rem' }}>No contacts yet</div>
              <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Import a CSV to build your mailing list.
              </div>
              <button onClick={() => setScreen('upload')} style={{ ...btn.base, ...btn.gold }}>
                Import CSV
              </button>
            </div>
          ) : (
            <ContactsList contacts={contacts} />
          )}
        </>
      )}

      {/* ── UPLOAD VIEW ── */}
      {screen === 'upload' && (
        <div>
          <DropZone onFile={handleFile} />
          <div style={{ marginTop: '1.2rem', color: C.textMid, fontSize: '0.8rem', lineHeight: 1.7 }}>
            <strong style={{ color: C.text }}>Required:</strong> one column named <code style={{ color: C.goldLight }}>email</code><br />
            <strong style={{ color: C.text }}>Optional:</strong> a column named <code style={{ color: C.goldLight }}>name</code> or <code style={{ color: C.goldLight }}>first_name</code><br />
            Duplicates are skipped automatically. All other columns are ignored.
          </div>
        </div>
      )}

      {/* ── PREVIEW VIEW ── */}
      {screen === 'preview' && parsed && (
        <div>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { label: 'Total rows',    value: parsed.rows.length },
              { label: 'Valid emails',  value: parsed.valid.length },
              { label: 'New to import', value: parsed.net.length, highlight: true },
            ].map(s => (
              <div key={s.label} style={{ background: C.card, border: `1px solid ${s.highlight ? C.gold + '55' : C.border}`, borderRadius: '10px', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: '800', color: s.highlight ? C.goldLight : C.text }}>
                  {s.value.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: C.textMid, marginTop: '0.2rem' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {parsed.dupes.length > 0 && (
            <div style={{ background: '#1a1200', border: `1px solid ${C.gold}33`, borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: C.goldLight }}>
              {parsed.dupes.length} already in your list — will be skipped.
            </div>
          )}

          {parsed.valid.length !== parsed.rows.length && (
            <div style={{ background: '#1a0000', border: `1px solid ${C.red}33`, borderRadius: '8px', padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: C.red }}>
              {parsed.rows.length - parsed.valid.length} rows have invalid emails — will be skipped.
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: C.textMid, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Preview</div>
            <PreviewTable rows={parsed.valid} emailCol={parsed.emailCol} nameCol={parsed.nameCol} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={runImport}
              disabled={parsed.net.length === 0}
              style={{ ...btn.base, ...btn.gold, opacity: parsed.net.length === 0 ? 0.4 : 1 }}
            >
              Import {parsed.net.length.toLocaleString()} contacts
            </button>
            <button onClick={() => { setScreen('upload'); setParsed(null) }} style={{ ...btn.base, ...btn.ghost }}>
              Try a different file
            </button>
          </div>
        </div>
      )}

      {/* ── IMPORTING ── */}
      {screen === 'importing' && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
          <div style={{ fontWeight: '700', marginBottom: '0.3rem' }}>Importing…</div>
          <div style={{ color: C.textMid, fontSize: '0.85rem' }}>Uploading in batches of 500</div>
        </div>
      )}

      {/* ── DONE ── */}
      {screen === 'done' && importRes && (
        <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <div style={{ fontWeight: '800', fontSize: '1.3rem', marginBottom: '0.4rem', color: C.goldLight }}>
            {importRes.added.toLocaleString()} contacts added
          </div>
          {importRes.skipped > 0 && (
            <div style={{ color: C.textMid, fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {importRes.skipped} duplicates skipped
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button onClick={() => { setScreen('upload'); setParsed(null); setImportRes(null) }} style={{ ...btn.base, ...btn.gold }}>
              Import another file
            </button>
            <button onClick={() => { setScreen('list'); setParsed(null); setImportRes(null) }} style={{ ...btn.base, ...btn.ghost }}>
              View list
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
