import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, X } from 'lucide-react';
import { useState } from 'react';

interface DocumentViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentUrl: string;
  documentName: string;
}

export function DocumentViewer({ open, onOpenChange, documentUrl, documentName }: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);
  
  const fileExtension = documentName.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension || '');
  const isPdf = fileExtension === 'pdf';
  const isDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExtension || '');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = documentUrl;
    link.download = documentName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(documentUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <DialogTitle>{documentName}</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
          <DialogDescription>
            Preview and download the document
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden rounded-md border bg-muted/20 relative">
          {loading && !pdfError && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-sm text-muted-foreground">Loading document...</p>
              </div>
            </div>
          )}
          
          {isImage ? (
            <img
              src={documentUrl}
              alt={documentName}
              className="w-full h-full object-contain"
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
          ) : isPdf ? (
            pdfError ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">PDF Preview Unavailable</p>
                  <p className="text-xs text-muted-foreground">
                    Some browsers don't support inline PDF viewing. Please open in a new tab or download.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleOpenInNewTab} variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    Open in New Tab
                  </Button>
                  <Button onClick={handleDownload} className="gap-2">
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <iframe
                src={`${documentUrl}#toolbar=0`}
                className="w-full h-full"
                title={documentName}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setPdfError(true);
                }}
              />
            )
          ) : isDoc ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Document Preview Unavailable</p>
                <p className="text-xs text-muted-foreground">
                  {fileExtension?.toUpperCase()} files cannot be previewed in the browser.
                  Please download to view in Microsoft Office or compatible software.
                </p>
              </div>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download {fileExtension?.toUpperCase()} File
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">Preview Not Available</p>
                <p className="text-xs text-muted-foreground">
                  This file type cannot be previewed in the browser.
                </p>
              </div>
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download to View
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
