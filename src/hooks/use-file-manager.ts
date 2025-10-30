"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { initialFiles } from '@/lib/data';
import type { FileNode, FileType, SortConfig } from '@/lib/types';
import { produce } from 'immer';

const findNodeByPath = (files: Map<string, FileNode>, path: string): FileNode | null => {
    if (path === '/') return null;
    for (const file of files.values()) {
        if (file.path === path) return file;
    }
    return null;
}

const getFileType = (file: File): FileType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('text/')) return 'text';
    return 'other';
}


export function useFileManager() {
  const [files, setFiles] = useState<Map<string, FileNode>>(new Map());
  const [currentPath, setCurrentPath] = useState('/');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [selection, setSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      const filesMap = new Map(initialFiles.map((file) => [file.id, file]));
      setFiles(filesMap);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    clearSelection();
  }, [currentPath]);

  const changeDirectory = (path: string) => {
    setSearchTerm('');
    setCurrentPath(path);
  };

  const search = (term: string) => {
    setSearchTerm(term);
  };

  const createNode = (name: string, type: FileType) => {
    if (!name) throw new Error("Name cannot be empty.");
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    if (findNodeByPath(files, newPath)) {
        throw new Error(`A file or folder with the name "${name}" already exists.`);
    }
    const parentNode = findNodeByPath(files, currentPath);
    const newNode: FileNode = {
      id: new Date().getTime().toString(),
      name,
      type,
      path: newPath,
      parentId: parentNode ? parentNode.id : null,
      modifiedAt: new Date().toISOString(),
      size: 0,
      content: type === 'text' ? '' : undefined,
    };
    setFiles(produce(draft => {
      draft.set(newNode.id, newNode);
    }));
  };

  const uploadFile = (file: File) => {
    const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    if (findNodeByPath(files, newPath)) {
        throw new Error(`A file with the name "${file.name}" already exists.`);
    }
    const parentNode = findNodeByPath(files, currentPath);
    const fileType = getFileType(file);
    const newNode: FileNode = {
      id: new Date().getTime().toString(),
      name: file.name,
      type: fileType,
      path: newPath,
      parentId: parentNode ? parentNode.id : null,
      modifiedAt: new Date(file.lastModified).toISOString(),
      size: file.size,
    };
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result as string;
        setFiles(produce(draft => {
            const createdNode = draft.get(newNode.id);
            if(createdNode) {
                if (fileType === 'image') createdNode.url = result;
                else if (fileType === 'text') createdNode.content = result.split(',')[1] ? atob(result.split(',')[1]) : '';
            }
        }));
    };
    if (fileType === 'image' || fileType === 'text') reader.readAsDataURL(file);
    setFiles(produce(draft => { draft.set(newNode.id, newNode); }));
  }

  const renameNode = (id: string, newName: string) => {
    if (!newName) throw new Error("Name cannot be empty.");
    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;
        const parentPath = node.path.substring(0, node.path.lastIndexOf('/')) || '/';
        const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;
        for (const file of draft.values()) {
            if (file.path === newPath && file.id !== id) {
                throw new Error(`An item named "${newName}" already exists.`);
            }
        }
        const oldPath = node.path;
        node.name = newName;
        node.path = newPath;
        node.modifiedAt = new Date().toISOString();
        if (node.type === 'folder') {
            for (const file of draft.values()) {
                if (file.path.startsWith(oldPath + '/')) {
                    const childNode = draft.get(file.id);
                    if (childNode) {
                        childNode.path = newPath + file.path.substring(oldPath.length);
                    }
                }
            }
        }
    }));
  };
  
  const deleteNodes = useCallback((ids: string[]) => {
    setFiles(produce(draft => {
        const nodesToDelete = new Set<string>(ids);

        ids.forEach(id => {
            const node = draft.get(id);
            if (!node || node.type !== 'folder') return;
            
            const findChildrenRecursive = (folderPath: string) => {
                for (const file of draft.values()) {
                    if (file.path.startsWith(folderPath + '/') && file.id !== id) {
                        nodesToDelete.add(file.id);
                        if (file.type === 'folder') {
                            findChildrenRecursive(file.path);
                        }
                    }
                }
            };
            findChildrenRecursive(node.path);
        });

        nodesToDelete.forEach(deleteId => draft.delete(deleteId));
    }));
    clearSelection();
  }, []);

  const moveNode = (id: string, newParentPath: string) => {
    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;
        let parentNode: FileNode | null = findNodeByPath(draft, newParentPath);
        if (newParentPath !== '/' && !parentNode) throw new Error("Destination folder does not exist.");
        if (node.type === 'folder' && newParentPath.startsWith(node.path)) throw new Error("Cannot move a folder into itself.");

        const newPath = newParentPath === '/' ? `/${node.name}` : `${newParentPath}/${node.name}`;
        if (findNodeByPath(draft, newPath)) throw new Error(`An item named "${node.name}" already exists in the destination.`);
        
        const oldPath = node.path;
        node.path = newPath;
        node.parentId = parentNode ? parentNode.id : null;
        node.modifiedAt = new Date().toISOString();

        if (node.type === 'folder') {
            for (const file of draft.values()) {
                if (file.path.startsWith(oldPath + '/')) {
                    const childNode = draft.get(file.id);
                    if (childNode) {
                        childNode.path = newPath + file.path.substring(oldPath.length);
                    }
                }
            }
        }
    }));
  }

  const getFolderPath = useCallback(() => {
    return ['/', ...Array.from(files.values()).filter(f => f.type === 'folder').map(f => f.path)].sort();
  }, [files]);
  
  const currentFiles = useMemo(() => {
    const filesInCurrentDir = Array.from(files.values()).filter(file => (file.path.substring(0, file.path.lastIndexOf('/')) || '/') === currentPath);
    const filtered = searchTerm ? filesInCurrentDir.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())) : filesInCurrentDir;

    return [...filtered].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;
      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') comparison = valA.localeCompare(valB);
      else if (typeof valA === 'number' && typeof valB === 'number') comparison = valA - valB;
      return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });
  }, [files, currentPath, searchTerm, sortConfig]);

  const toggleSelection = (id: string) => {
    setSelection(produce(draft => {
      if (draft.has(id)) draft.delete(id);
      else draft.add(id);
    }));
  };
  
  const selectRange = (ids: string[]) => {
    setSelection(produce(draft => {
      ids.forEach(id => draft.add(id));
    }));
  };

  const clearSelection = () => {
    if(selection.size > 0) setSelection(new Set());
  };

  return {
    files,
    currentPath,
    currentFiles,
    changeDirectory,
    createNode,
    deleteNodes,
    renameNode,
    moveNode,
    getFolderPath,
    search,
    searchTerm,
    isLoading,
    sortConfig,
    setSortConfig,
    uploadFile,
    selection,
    toggleSelection,
    clearSelection,
    selectRange
  };
}