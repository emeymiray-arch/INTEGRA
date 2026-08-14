import { useCallback, useState, type DragEvent } from 'react';
import { FileUp, Upload, X } from 'lucide-react';
import { cn } from '../lib/cn';

export interface FileUploadProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  onFilesSelected: (files: File[]) => void;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  accept,
  multiple = false,
  maxSizeMb = 10,
  onFilesSelected,
  className,
  disabled = false,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validateFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const maxBytes = maxSizeMb * 1024 * 1024;
      const valid = list.filter((f) => f.size <= maxBytes);
      if (valid.length < list.length) {
        setError(`Максимальный размер файла — ${maxSizeMb} МБ`);
      } else {
        setError(null);
      }
      return valid;
    },
    [maxSizeMb],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const valid = validateFiles(files);
      if (!valid.length) return;
      const next = multiple ? [...selectedFiles, ...valid] : valid.slice(0, 1);
      setSelectedFiles(next);
      onFilesSelected(valid);
    },
    [multiple, onFilesSelected, selectedFiles, validateFiles],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors',
          dragOver
            ? 'border-secondary bg-secondary/5'
            : 'border-integra-gray-200 bg-integra-gray-50/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Upload className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-integra-gray-900">
          Перетащите файлы сюда
        </p>
        <p className="mt-1 text-xs text-integra-gray-600">
          или выберите с устройства (до {maxSizeMb} МБ)
        </p>
        <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-secondary/30 bg-secondary/15 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-secondary/25">
          <input
            type="file"
            className="hidden"
            accept={accept}
            multiple={multiple}
            disabled={disabled}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <FileUp className="h-4 w-4" />
          Выбрать файл
        </label>
      </div>

      {error && <p className="text-xs text-integra-error">{error}</p>}

      {selectedFiles.length > 0 && (
        <ul className="space-y-2">
          {selectedFiles.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-xl border border-integra-gray-100 bg-white px-3 py-2 text-sm"
            >
              <span className="truncate text-integra-gray-900">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="ml-2 shrink-0 text-integra-gray-400 hover:text-integra-error"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
