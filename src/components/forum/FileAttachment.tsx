import { FileText, Download, File, Image as ImageIcon, Video, Music } from "lucide-react";

interface FileAttachmentProps {
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
}

const getFileIcon = (type?: string) => {
  if (!type) return <File className="w-5 h-5" />;
  if (type.startsWith("image/")) return <ImageIcon className="w-5 h-5 text-primary" />;
  if (type.startsWith("video/")) return <Video className="w-5 h-5 text-primary" />;
  if (type.startsWith("audio/")) return <Music className="w-5 h-5 text-primary" />;
  if (type.includes("pdf")) return <FileText className="w-5 h-5 text-destructive" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
};

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

const FileAttachment = ({ fileName, fileUrl, fileSize, fileType }: FileAttachmentProps) => {
  return (
    <div className="flex items-center gap-3 bg-secondary/60 rounded-xl p-3 mt-2 max-w-xs border border-border">
      <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center flex-shrink-0">
        {getFileIcon(fileType)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{fileName}</p>
        {fileSize && (
          <p className="text-[10px] text-muted-foreground">{formatFileSize(fileSize)}</p>
        )}
      </div>
      <a
        href={fileUrl}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 text-primary hover:bg-primary/10 rounded-full transition-colors flex-shrink-0"
      >
        <Download className="w-4 h-4" />
      </a>
    </div>
  );
};

export default FileAttachment;
