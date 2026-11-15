'use client';

import { useEffect, useMemo, useState } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { ReportDocument, type ReportDocumentProps } from '@/components/report/ReportDocument';
import { cn } from '@/lib/utils';

// The iframe needs an accessible name. PDFViewer does not pass a title prop to it.
function nameFrame(frame: HTMLIFrameElement | null) {
  frame?.setAttribute('title', 'Preview of the client report');
}

// Wait this long after the last change before the preview renders the PDF again.
const DEBOUNCE_MS = 400;

/**
 * The live PDF preview. Load it only in the browser, with next/dynamic and ssr: false.
 * It renders the same ReportDocument as the export, with the same props.
 */
export default function ReportPreview({ scan, pagespeed, draft, branding }: ReportDocumentProps) {
  const [settled, setSettled] = useState<ReportDocumentProps>({ scan, pagespeed, draft, branding });

  useEffect(() => {
    const timer = setTimeout(() => setSettled({ scan, pagespeed, draft, branding }), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [scan, pagespeed, draft, branding]);

  // A new document element makes the viewer render the PDF again. Make one only when the props settle.
  const document = useMemo(() => <ReportDocument {...settled} />, [settled]);

  return (
    <PDFViewer
      showToolbar={false}
      innerRef={nameFrame}
      className={cn(
        'block w-full rounded-md border bg-muted',
        settled.branding.region === 'US' ? 'aspect-[8.5/11]' : 'aspect-[210/297]',
      )}
    >
      {document}
    </PDFViewer>
  );
}
