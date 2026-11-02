import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { describeScenario, runAsk, type AskAnswer } from '@/core';
import { supabase } from '@/integrations/supabase/client';
import { useModel } from '@/state/ModelContext';

const CHIPS = [
  'Who will be available in 4 weeks?',
  'What happens if two pipeline projects start at the same time?',
  'Which skill will we run short of?',
  'Who is over 100%, and who is idle?',
  'How much of our time went to billable work?',
  'Do we have enough Java developers in December?',
  'Which project drifted most from plan in the last 5 weeks?',
  'How much of the Orbit e-shop budget have we used?',
];

const FUNCTIONS: [string, string][] = [
  ['freeCapacity()', 'Who has free hours in a week, by stack'],
  ['scenarioImpact()', 'What changes when pipeline projects switch on'],
  ['skillGap()', 'Which stack is short or spare, by week'],
  ['loadByPerson()', 'Who is over or under their capacity'],
  ['billableSplit()', 'Billable share of logged time'],
  ['planVsActual()', 'Plan against Jira hours'],
  ['projectBurn()', 'Hours used against a project budget'],
];

const callEdge = (body: Record<string, unknown>) =>
  supabase.functions.invoke('ask', { body }).then((r) => { if (r.error) throw r.error; return r.data; });

export default function Ask() {
  const { model, scenario, setScenario } = useModel();
  const [params] = useSearchParams();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const ran = useRef(false);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ(text);
    setBusy(text);
    setAnswer(null);
    try {
      setAnswer(await runAsk(model, text, scenario, callEdge));
    } catch (e) {
      setAnswer({ question: text, askedAt: new Date().toISOString(), status: 'error', conclusion: 'Something went wrong. Try again.',
        usedTemplate: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    const pre = params.get('q');
    if (pre && !ran.current) { ran.current = true; ask(pre); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-[1180px] space-y-4 pb-24">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow">Questions answered from your data</div>
          <h1 className="text-[22px] font-semibold">Ask</h1>
        </div>
        <div className="flex items-center gap-3 text-[12px]">
          <span className="bg-hover rounded px-2 py-1">Scenario: <b>{describeScenario(model, scenario)}</b></span>
          <button className="border border-input rounded px-2.5 py-1 hover:bg-hover"
            onClick={() => { setAnswer(null); setQ(''); if (scenario) setScenario(undefined); }}>Clear</button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-4 items-start">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-[16px] font-semibold">What do you want to know about capacity?</h2>
            <p className="text-ink2 mt-1 mb-4 max-w-[620px]">Ask in plain words. Every number in the answer comes from a tested function over the sample HR and Jira exports. Claude only writes the conclusion.</p>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button key={c} disabled={!!busy} onClick={() => ask(c)}
                  className="border border-input rounded-full px-3 py-1 text-[12px] bg-white hover:bg-hover disabled:text-hint">{c}</button>
              ))}
            </div>
          </section>

          {busy && (
            <section className="card p-5 flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber animate-pulse" />
              <span className="text-ink2">Answering “{busy}”…</span>
            </section>
          )}
          {answer && !busy && <AnswerCard a={answer} onRetry={() => ask(answer.question)} />}
        </div>

        <aside className="space-y-4">
          <section className="card p-4 text-[12px] text-ink2 space-y-2">
            <div className="eyebrow">How an answer is made</div>
            <p>1. Claude picks one function that fits your question, with its inputs.</p>
            <p>2. The app runs that function on the imported HR and Jira data and your plan edits.</p>
            <p>3. Claude writes a short conclusion using only the numbers the function returned. Claude never calculates.</p>
            <p>4. The app checks every number in the conclusion against the result; if one does not match, a standard sentence is shown instead.</p>
          </section>
          <section className="card p-4 text-[12px]">
            <div className="eyebrow mb-2">Functions it can use</div>
            <ul className="space-y-1.5">
              {FUNCTIONS.map(([n, d]) => (
                <li key={n} className="bg-page rounded px-2 py-1.5"><span className="font-mono text-navy">{n}</span><div className="text-ink2">{d}</div></li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      <form className="fixed bottom-0 left-[200px] right-0 bg-page/95 border-t border-line px-4 py-3"
        onSubmit={(e) => { e.preventDefault(); ask(q); }}>
        <div className="max-w-[1180px] flex gap-2">
          <input aria-label="Question" value={q} onChange={(e) => setQ(e.target.value)} maxLength={500}
            placeholder="Ask about capacity, skills, scenarios or billable time"
            className="flex-1 border border-input rounded px-3 py-2 bg-white" />
          <button type="submit" disabled={!!busy || !q.trim()}
            className="bg-navy hover:bg-navy-dark text-white rounded px-4 disabled:bg-hint">Ask</button>
        </div>
      </form>
    </div>
  );
}

function AnswerCard({ a, onRetry }: { a: AskAnswer; onRetry: () => void }) {
  const dot = a.status === 'answer' ? 'bg-navy' : a.status === 'cannot' ? 'bg-hint' : 'bg-amber';
  return (
    <section className="card p-5 space-y-4" aria-label="Answer">
      <div className="text-[12px] text-ink2">“{a.question}”</div>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
        <div>
          {a.status === 'answer' && <div className="eyebrow mb-1">Conclusion · written by Claude from the numbers below</div>}
          <p className="text-[15px]">{a.conclusion}</p>
          {a.usedTemplate && <p className="text-[11px] text-amber-text mt-1">Standard sentence used: the written answer did not pass the number check.</p>}
          {a.status === 'error' && (
            <>
              {a.error && <p className="font-mono text-[11px] text-ink2 mt-1">{a.error}</p>}
              <button onClick={onRetry} className="mt-3 border border-input rounded px-3 py-1 text-[12px] hover:bg-hover">Try again</button>
            </>
          )}
        </div>
      </div>

      {a.table && a.table.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] border-collapse">
            <thead><tr className="border-b border-line text-left">{a.table.columns.map((c) => <th key={c} className="eyebrow py-1.5 pr-3">{c}</th>)}</tr></thead>
            <tbody>
              {a.table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  {r.map((v, j) => <td key={j} className={`py-1.5 pr-3 ${typeof v === 'number' ? 'font-mono' : ''}`}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {a.function && (
        <div className="bg-page rounded p-3 text-[12px] space-y-2">
          <div className="eyebrow">How this was worked out</div>
          <div>Function: <span className="font-mono text-navy">{a.function}()</span></div>
          <div>Arguments:<pre className="font-mono text-[11px] bg-white border border-line rounded p-2 mt-1 overflow-x-auto">{JSON.stringify(a.args ?? {}, null, 2)}</pre></div>
          {a.scenario && <div>Scenario: <b>{a.scenario}</b></div>}
          {a.dataRead && (
            <div>
              Data read: {a.dataRead.summary}
              <ul className="mt-1 font-mono text-[11px] text-ink2">
                {a.dataRead.files.map((f) => <li key={f.path}>{f.path} · {f.label} · {f.rows} rows</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
