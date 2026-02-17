import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

type TransformKey = 'stripAwsTracking' | 'hostnameReplace'

type TransformDef<C extends Record<string, string> = Record<string, string>> = {
  key: TransformKey
  label: string
  ConfigUI?: (props: {
    config: Partial<C>
    onChange: (field: keyof C & string, value: string) => void
  }) => ReactNode
  fn: (url: string, config: Partial<C>) => string | null
}

const HOSTNAME_PRESETS = [
  'epic-pay-by-invoice.reg-preview.crowdcomms.com',
]

type HostnameReplaceConfig = { to: string }

function makeTransform<C extends Record<string, string>>(def: TransformDef<C>): TransformDef {
  return def as TransformDef
}

const TRANSFORMS: TransformDef[] = [
  makeTransform({
    key: 'stripAwsTracking',
    label: 'Strip AWS tracking',
    fn: (url) => {
      const match = url.match(/\/L0\/([^/]+)/)
      if (!match) return null
      try {
        return decodeURIComponent(match[1])
      } catch {
        return null
      }
    },
  }),
  makeTransform<HostnameReplaceConfig>({
    key: 'hostnameReplace',
    label: 'Replace hostname',
    ConfigUI: ({ config, onChange }) => (
      <div className="flex gap-2 ml-2 items-center">
        <select
          value={HOSTNAME_PRESETS.includes(config.to ?? '') ? config.to : '__custom__'}
          onChange={e => onChange('to', e.target.value === '__custom__' ? '' : e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="__custom__">Custom</option>
          {HOSTNAME_PRESETS.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="hostname"
          value={config.to ?? ''}
          onChange={e => onChange('to', e.target.value)}
          className="px-2 py-1 border border-gray-300 rounded text-sm font-mono w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    ),
    fn: (url, { to }) => {
      if (!to) return null
      try {
        const parsed = new URL(url)
        parsed.hostname = to
        return parsed.toString()
      } catch {
        return null
      }
    },
  }),
]

const ALL_KEYS = TRANSFORMS.map(t => t.key)
const TRANSFORM_MAP = Object.fromEntries(TRANSFORMS.map(t => [t.key, t])) as Record<TransformKey, TransformDef>

function parseOrder(param: string | null): TransformKey[] {
  if (!param) return ALL_KEYS
  const keys = param.split(',').filter((k): k is TransformKey => k in TRANSFORM_MAP)
  const missing = ALL_KEYS.filter(k => !keys.includes(k))
  return [...keys, ...missing]
}

function parseActive(param: string | null): Set<TransformKey> {
  if (!param) return new Set()
  return new Set(param.split(',').filter((k): k is TransformKey => k in TRANSFORM_MAP))
}

function parseConfigs(params: URLSearchParams): Partial<Record<TransformKey, Record<string, string>>> {
  const configs: Partial<Record<TransformKey, Record<string, string>>> = {}
  for (const [param, value] of params.entries()) {
    const dotIdx = param.indexOf('.')
    if (dotIdx === -1) continue
    const key = param.slice(0, dotIdx) as TransformKey
    const field = param.slice(dotIdx + 1)
    if (!(key in TRANSFORM_MAP)) continue
    configs[key] = { ...configs[key], [field]: value }
  }
  return configs
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export default function UrlTool() {
  const [searchParams, setSearchParams] = useSearchParams()
  const url = searchParams.get('u') ?? ''
  const [copiedOutput, setCopiedOutput] = useState(false)
  const [copiedInput, setCopiedInput] = useState(false)

  const order = parseOrder(searchParams.get('order'))
  const selected = parseActive(searchParams.get('active'))
  const configs = parseConfigs(searchParams)

  const urlInvalid = url !== '' && !isValidUrl(url)

  function setUrl(value: string) {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (value) { p.set('u', value) } else { p.delete('u') }
      return p
    }, { replace: true })
  }

  function toggle(key: TransformKey) {
    const next = new Set(selected)
    if (next.has(key)) { next.delete(key) } else { next.add(key) }
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next.size > 0) { p.set('active', [...next].join(',')) } else { p.delete('active') }
      return p
    }, { replace: true })
  }

  function setConfig(key: TransformKey, field: string, value: string) {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (value) { p.set(`${key}.${field}`, value) } else { p.delete(`${key}.${field}`) }
      return p
    }, { replace: true })
  }

  function move(key: TransformKey, dir: -1 | 1) {
    const idx = order.indexOf(key)
    const swapWith = idx + dir
    if (swapWith < 0 || swapWith >= order.length) return
    const next = [...order]
    ;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set('order', next.join(','))
      return p
    }, { replace: true })
  }

  // Run each active transform step-by-step, tracking per-transform results
  const transformResults = order
    .filter(k => selected.has(k))
    .reduce<{ key: TransformKey; result: string | null; output: string }[]>((acc, key) => {
      const input = acc.length > 0 ? acc[acc.length - 1].output : url
      const t = TRANSFORM_MAP[key]
      const result = t.fn(input, configs[key] ?? {})
      return [...acc, { key, result, output: result ?? input }]
    }, [])

  const resultByKey = Object.fromEntries(transformResults.map(r => [r.key, r.result]))
  const output = transformResults.length > 0 ? transformResults[transformResults.length - 1].output : url

  function handleCopyOutput() {
    void navigator.clipboard.writeText(output)
    setCopiedOutput(true)
    setTimeout(() => setCopiedOutput(false), 1500)
  }

  function handleCopyInput() {
    void navigator.clipboard.writeText(url)
    setCopiedInput(true)
    setTimeout(() => setCopiedInput(false), 1500)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">URL</h2>

      <div className="space-y-1">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Paste a URL..."
            className={`flex-1 px-4 py-2 border rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${urlInvalid ? 'border-red-400' : 'border-gray-300'}`}
          />
          {url && (
            <>
              <button
                onClick={handleCopyInput}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
              >
                {copiedInput ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => setUrl('')}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg bg-white"
              >
                Clear
              </button>
            </>
          )}
        </div>
        {urlInvalid && (
          <p className="text-xs text-red-500">Not a valid URL</p>
        )}
      </div>

      <>
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Transformations</h3>
          {order.map((key, idx) => {
            const t = TRANSFORM_MAP[key]
            const isSelected = selected.has(key)
            const result = resultByKey[key]
            return (
              <div key={key} className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    onClick={() => move(key, -1)}
                    disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30 text-xs leading-none"
                  >▲</button>
                  <button
                    onClick={() => move(key, 1)}
                    disabled={idx === order.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30 text-xs leading-none"
                  >▼</button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(key)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{t.label}</span>
                </label>
                {isSelected && t.ConfigUI && (
                  <t.ConfigUI
                    config={configs[key] ?? {}}
                    onChange={(field, value) => setConfig(key, field, value)}
                  />
                )}
                {isSelected && url && !urlInvalid && (
                  <span className={`ml-auto text-xs font-medium ${result !== null ? 'text-green-600' : 'text-gray-400'}`}>
                    {result !== null ? 'applied' : 'no match'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Output</h3>
            <button
              onClick={handleCopyOutput}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {copiedOutput ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            readOnly
            value={output}
            rows={4}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 text-gray-700 resize-none"
          />
        </div>
      </>
    </div>
  )
}
