export type FileType = 'image' | 'pdf' | 'text' | 'folder' | 'other';

export type FileNode = {
  id: string;
  name: string;
  type: FileType;
  path: string;
  parentId: string | null;
  modifiedAt: string;
  size: number;
  content?: string; // For previewable files like text
  url?: string; // For previewable files like images/pdfs
};

export type SortConfig = {
  key: keyof FileNode;
  direction: 'ascending' | 'descending';
};

    