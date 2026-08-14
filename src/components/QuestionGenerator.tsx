import { useState } from 'react';
import { Bot, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react';
import { Hypothesis } from '../db/models';
import type { GeneratedInterviewQuestion } from '../services/ai';

interface QuestionGeneratorProps {
  validationGaps: Hypothesis[];
}

export function QuestionGenerator({ validationGaps }: QuestionGeneratorProps) {
  const [questions, setQuestions] = useState<GeneratedInterviewQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (validationGaps.length === 0) return;
    try {
      setIsGenerating(true);
      setError('');
      const { generateInterviewQuestions } = await import('../services/ai');
      setQuestions(await generateInterviewQuestions(validationGaps));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to generate questions.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (validationGaps.length === 0) return null;

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <Bot size={20} className="text-primary-700" />
          <h2 className="font-semibold text-surface-950">AI Interview Planner</h2>
        </div>
      </div>
      <div className="p-5">
        {questions.length > 0 ? (
          <ol className="space-y-4">
            {questions.map((question, index) => (
              <li key={`${question.question}-${index}`} className="border-l-2 border-primary-200 pl-4">
                <p className="text-sm font-semibold leading-6 text-surface-900">{question.question}</p>
                <p className="mt-1 text-xs leading-5 text-surface-500">{question.rationale}</p>
                <p className="mt-1 text-[11px] font-semibold text-primary-700">Targets: {question.targetHypothesis}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm leading-6 text-surface-600">Generate focused questions that challenge your highest-priority assumptions using past behavior instead of leading prompts.</p>
        )}

        {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}

        <button type="button" onClick={handleGenerate} disabled={isGenerating} className="button-secondary mt-5 w-full border-primary-300 text-primary-700 hover:bg-primary-50">
          {isGenerating ? <LoaderCircle size={17} className="animate-spin" /> : questions.length > 0 ? <RefreshCw size={17} /> : <Sparkles size={17} />}
          {isGenerating ? 'Generating plan…' : questions.length > 0 ? 'Regenerate Interview Plan' : 'Generate Interview Plan'}
        </button>
      </div>
    </section>
  );
}
