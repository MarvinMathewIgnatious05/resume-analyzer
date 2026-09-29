declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: any;
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; logging?: boolean };
    jsPDF?: { unit?: string; format?: string | number[]; orientation?: 'portrait' | 'landscape' };
    pagebreak?: { mode?: string | string[]; before?: string | string[]; after?: string | string[] };
  }

  interface Html2PdfWorker {
    from(element: HTMLElement | string): Html2PdfWorker;
    set(options: Html2PdfOptions): Html2PdfWorker;
    save(): Promise<void>;
    output(type: string): Promise<any>;
  }

  function html2pdf(): Html2PdfWorker;
  function html2pdf(element: HTMLElement | string, options?: Html2PdfOptions): Promise<void> | Html2PdfWorker;

  export default html2pdf;
}
