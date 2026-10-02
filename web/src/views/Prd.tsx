import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowRight } from 'lucide-react';
import { PRD_MARKDOWN } from '../generated/prd';
import { useDemo } from '../state/DemoContext';
import { Button, Card } from '../components/ui';

export function Prd() {
  const { go } = useDemo();
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-6 sm:p-12">
        <article className="prd max-w-4xl">
          <Markdown remarkPlugins={[remarkGfm]}>{PRD_MARKDOWN}</Markdown>
        </article>
      </Card>
      <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Card className="p-6">
          <div className="eyebrow text-amber">Stage 1 · Discovery</div>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">Next: ingest the legacy tree read-only and recover its specification before any code changes.</p>
          <Button className="mt-5 w-full" onClick={() => go('workbench', 'scan')}>Legacy Code Ingestion <ArrowRight size={18} /></Button>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => go('presenter')}>Back to Presenter</Button>
        </Card>
      </div>
    </div>
  );
}
