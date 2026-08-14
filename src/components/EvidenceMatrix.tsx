import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useStore } from '../store/useStore';
import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';

export function EvidenceMatrix() {
  const activeProjectId = useStore(state => state.activeProjectId);
  const hypotheses = useLiveQuery(() => activeProjectId ? db.hypotheses.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId]);
  const segments = useLiveQuery(() => activeProjectId ? db.segments.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId]);
  const evidence = useLiveQuery(() => activeProjectId ? db.evidenceSignals.where('projectId').equals(activeProjectId).toArray() : [], [activeProjectId]);

  if (!hypotheses || !segments || !evidence) return null;

  // Build matrix data
  const matrix = hypotheses.map(h => {
    const row = { hypothesis: h, segments: {} as Record<string, { status: 'positive' | 'negative' | 'mixed' | 'none', supports: number; contradicts: number; neutral: number }> };

    segments.forEach(s => {
      const segmentEvidence = evidence.filter(e => e.hypothesisId === h.id && e.segmentId === s.id);
      const supporting = segmentEvidence.filter(e => e.relationship === 'supports').length;
      const contradicting = segmentEvidence.filter(e => e.relationship === 'contradicts').length;
      const neutral = segmentEvidence.filter(e => e.relationship === 'neutral').length;

      let status: 'positive' | 'negative' | 'mixed' | 'none' = 'none';
      if (supporting > 0 && contradicting === 0) status = 'positive';
      else if (contradicting > 0 && supporting === 0) status = 'negative';
      else if (supporting > 0 && contradicting > 0) status = 'mixed';

      row.segments[s.id] = { status, supports: supporting, contradicts: contradicting, neutral };
    });

    return row;
  });

  if (segments.length === 0) {
    return <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 px-5 py-8 text-center text-sm text-surface-600">Add segments to compare support and counterevidence across audiences.</div>;
  }

  return (
    <div className="overflow-x-auto border border-surface-200 rounded-lg">
      <table className="w-full text-sm text-left">
        <thead className="bg-surface-50 text-surface-700 uppercase">
          <tr>
            <th className="px-4 py-3 font-semibold border-b border-surface-200 w-1/3">Hypothesis</th>
            {segments.map(s => (
              <th key={s.id} className="px-4 py-3 font-semibold border-b border-surface-200 border-l border-surface-200 text-center">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map(row => (
            <tr key={row.hypothesis.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
              <td className="px-4 py-3 border-r border-surface-100 font-medium text-surface-900">
                {row.hypothesis.statement}
              </td>
              {segments.map(s => {
                const cell = row.segments[s.id];
                return (
                  <td key={s.id} className="px-4 py-3 text-center border-l border-surface-100">
                    {cell.status === 'none' && <span className="text-surface-300">-</span>}
                    {cell.status === 'positive' && (
                      <div className="flex flex-col items-center text-green-600">
                        <CheckCircle size={20} />
                        <span className="text-[10px] mt-1">{cell.supports} supports{cell.neutral ? ` · ${cell.neutral} neutral` : ''}</span>
                      </div>
                    )}
                    {cell.status === 'negative' && (
                      <div className="flex flex-col items-center text-red-600">
                        <XCircle size={20} />
                        <span className="text-[10px] mt-1">{cell.contradicts} contradicts{cell.neutral ? ` · ${cell.neutral} neutral` : ''}</span>
                      </div>
                    )}
                    {cell.status === 'mixed' && (
                      <div className="flex flex-col items-center text-orange-500">
                        <HelpCircle size={20} />
                        <span className="text-[10px] mt-1">{cell.supports} support · {cell.contradicts} counter{cell.neutral ? ` · ${cell.neutral} neutral` : ''}</span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {matrix.length === 0 && (
            <tr>
              <td colSpan={segments.length + 1} className="px-4 py-8 text-center text-surface-500">
                No hypotheses to display.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
