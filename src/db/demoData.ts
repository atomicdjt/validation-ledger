import { db } from './db';
import { generateId } from '../utils/id';
import { useStore } from '../store/useStore';

export async function injectDemoData() {
  const count = await db.projects.count();
  if (count > 0) return; // Only inject if DB is empty

  const projectId = generateId();

  await db.projects.add({
    id: projectId,
    name: "Quote Calculator Toolkit",
    productDescription: "A self-serve web widget that allows freelance designers to let potential clients calculate rough project estimates on their portfolio site without booking a discovery call.",
    validationObjective: "Validate if freelancers are willing to pay for a tool that filters out low-budget leads automatically.",
    stage: "ideation",
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const segmentId = generateId();
  await db.segments.add({
    id: segmentId,
    projectId,
    name: "Freelance Web Designers",
    description: "Independent web designers charging $2k - $10k per project.",
    characteristics: ["uses WebFlow or WordPress", "freelance"],
    priority: "high"
  });

  const h1Id = generateId();
  const h2Id = generateId();
  const h3Id = generateId();

  await db.hypotheses.bulkAdd([
    {
      id: h1Id,
      projectId,
      statement: "Freelancers waste at least 2 hours per week on discovery calls with leads who cannot afford them.",
      category: 'other',
      status: 'weak-evidence',
      importance: 'critical',
      confidenceScore: 0,
      createdAt: Date.now()
    },
    {
      id: h2Id,
      projectId,
      statement: "Freelancers will embed a pricing calculator widget on their own websites.",
      category: 'other',
      status: 'weak-evidence',
      importance: 'high',
      confidenceScore: 0,
      createdAt: Date.now()
    },
    {
      id: h3Id,
      projectId,
      statement: "Freelancers will pay $20/month for this tool.",
      category: 'other',
      status: 'weak-evidence',
      importance: 'medium',
      confidenceScore: 0,
      createdAt: Date.now()
    }
  ]);

  const source1Id = generateId();
  const source2Id = generateId();

  await db.sources.bulkAdd([
    {
      id: source1Id,
      projectId,
      segmentId,
      participantId: "sarah_123",
      type: 'interview',
      date: Date.now(),
      rawText: "I probably do 3 discovery calls a week where they end up having a $500 budget and I charge $3k minimum. It's exhausting.",
      metadata: { title: 'Interview with Sarah' },
      tags: ["webflow"]
    },
    {
      id: source2Id,
      projectId,
      segmentId,
      participantId: "anon_survey_14",
      type: 'survey',
      date: Date.now(),
      rawText: "If it synced with my Dubsado CRM, I'd pay maybe $15 a month for it.",
      metadata: { title: 'Pricing Survey Response #14' },
      tags: ["pricing"]
    }
  ]);

  await db.evidenceSignals.bulkAdd([
    {
      id: generateId(),
      projectId,
      sourceId: source1Id,
      segmentId,
      hypothesisId: h1Id,
      relationship: 'supports',
      classification: 'pain',
      statement: "Spends a lot of time on calls with people who have $500 budgets.",
      exactExcerpt: "I probably do 3 discovery calls a week where they end up having a $500 budget and I charge $3k minimum. It's exhausting.",
      isDirect: true,
      confidence: 5,
      notes: '',
      createdAt: Date.now()
    },
    {
      id: generateId(),
      projectId,
      sourceId: source1Id,
      segmentId,
      hypothesisId: h2Id,
      relationship: 'contradicts',
      classification: 'objection',
      statement: "Doesn't want to show prices upfront.",
      exactExcerpt: "I'd never put a calculator on my site. Every project is custom, and if they see a high number without me explaining the value, they'll bounce.",
      isDirect: true,
      confidence: 5,
      notes: '',
      createdAt: Date.now()
    },
    {
      id: generateId(),
      projectId,
      sourceId: source2Id,
      segmentId,
      hypothesisId: h3Id,
      relationship: 'supports',
      classification: 'willingness_to_pay',
      statement: "Willing to pay $15/mo.",
      exactExcerpt: "If it synced with my Dubsado CRM, I'd pay maybe $15 a month for it.",
      isDirect: true,
      confidence: 5,
      notes: '',
      createdAt: Date.now()
    }
  ]);

  await db.decisions.add({
    id: generateId(),
    projectId,
    title: "Pivot to CRM integration",
    description: "Move from standalone widget to CRM integration",
    reason: "Designers are hesitant to put raw calculators on their site without context, but are willing to use it as a form that dumps straight into their CRM (like Dubsado). We need to validate CRM integration next.",
    confidence: 'moderate',
    createdAt: Date.now()
  });

  // Set as active project
  useStore.getState().setActiveProject(projectId);
}
