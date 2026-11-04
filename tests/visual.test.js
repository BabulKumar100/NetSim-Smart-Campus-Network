import { describe, expect, it } from 'vitest'
import { deviceVlanLabel, nslookupTranscript, polylineKeyPoints, polylinePath, tracePoints } from '../lib/visual'
import { createInitialState } from '../lib/network/state'
import { testConnectivity } from '../lib/network/engine'
import { dnsLookup } from '../lib/network/services'
import { getDevice } from '../lib/network/l2'

describe('UI visual helpers', () => {
  it('maps a traced engine path onto canvas coordinates', () => {
    const state = createInitialState()
    const r = testConnectivity(state, { sourceId: 'CSE-PC1', destination: { deviceId: 'SRV-CORE' } })
    const pts = tracePoints(state.devices, r.forward.path)
    expect(pts.map((p) => p.id)).toEqual(r.forward.path)
    expect(polylinePath(pts).startsWith(`M ${pts[0].x} ${pts[0].y}`)).toBe(true)
    expect(tracePoints(state.devices, ['CSE-PC1', 'NOPE']).length).toBe(1)
  })

  it('computes length-proportional key points from 0 to 1', () => {
    const keys = polylineKeyPoints([
      { x: 0, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 10 },
    ])
    expect(keys).toEqual([0, 0.75, 1])
    expect(polylineKeyPoints([{ x: 1, y: 1 }])).toEqual([0])
  })

  it('labels devices with their VLAN', () => {
    const state = createInitialState()
    expect(deviceVlanLabel(state, getDevice(state, 'CSE-PC1'))).toBe('VLAN 10 · CSE')
    expect(deviceVlanLabel(state, getDevice(state, 'R1'))).toBe('Trunk (all VLANs)')
  })

  it('renders nslookup transcripts for resolved and missing names', () => {
    const state = createInitialState()
    const server = { name: 'dns.campus.local', ip: '10.10.40.10' }
    const ok = nslookupTranscript(dnsLookup(state, 'CSE-PC1', 'portal.campus.local'), server)
    expect(ok).toContain('Name:    portal.campus.local')
    expect(ok).toContain('Address:  10.10.40.10')
    const missing = nslookupTranscript(dnsLookup(state, 'CSE-PC1', 'nothing.campus.local'), server)
    expect(missing).toContain('Non-existent domain')
  })
})
