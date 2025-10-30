"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { initialFiles } from '@/lib/data';
import type { FileNode, FileType, SortConfig } from '@/lib/types';
import { produce } from 'immer';

// Helper function to find a file by path.
const findNodeByPath = (files: Map<string, FileNode>, path: string): FileNode | null => {
    if (path === '/') {
        return null;
    }
    for (const file of files.values()) {
        if (file.path === path) {
            return file;
        }
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

  useEffect(() => {
    // Simulate loading from an API
    const timer = setTimeout(() => {
      const filesMap = new Map(initialFiles.map((file) => [file.id, file]));
      setFiles(filesMap);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
                if (fileType === 'image') {
                    createdNode.url = result;
                } else if (fileType === 'text') {
                    createdNode.content = result.split(',')[1] ? atob(result.split(',')[1]) : '';
                }
            }
        }));
    };

    if (fileType === 'image') {
        reader.readAsDataURL(file);
    } else if (fileType === 'text') {
        reader.readAsDataURL(file);
    }
    
    setFiles(produce(draft => {
      draft.set(newNode.id, newNode);
    }));
  }

  const renameNode = (id: string, newName: string) => {
    if (!newName) throw new Error("Name cannot be empty.");

    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;

        const parentPath = node.path.substring(0, node.path.lastIndexOf('/')) || '/';
        const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

        // Check for name collision in the same directory
        for (const file of draft.values()) {
            if (file.path === newPath && file.id !== id) {
                throw new Error(`An item named "${newName}" already exists.`);
            }
        }
        
        const oldPath = node.path;
        node.name = newName;
        node.path = newPath;
        node.modifiedAt = new Date().toISOString();

        // Update children paths if it's a folder
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
  
  const deleteNode = (id: string) => {
    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;

        const nodesToDelete = new Set<string>();
        nodesToDelete.add(id);

        if (node.type === 'folder') {
            const findChildrenRecursive = (folderPath: string) => {
                for (const file of draft.values()) {
                    if (file.parentId === node.id || file.path.startsWith(folderPath + '/')) {
                        nodesToDelete.add(file.id);
                        if (file.type === 'folder') {
                            findChildrenRecursive(file.path);
                        }
                    }
                }
            };
            findChildrenRecursive(node.path);
        }
        
        nodesToDelete.forEach(deleteId => draft.delete(deleteId));
    }));
  };

  const moveNode = (id: string, newParentPath: string) => {
    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;
        
        let parentNode: FileNode | null = null;
        if (newParentPath !== '/') {
            for(const file of draft.values()) {
                if(file.path === newParentPath) {
                    parentNode = file;
                    break;
                }
            }
            if (!parentNode) throw new Error("Destination folder does not exist.");
        }

        if (node.type === 'folder' && newParentPath.startsWith(node.path)) {
            throw new Error("Cannot move a folder into itself.");
        }

        const newPath = newParentPath === '/' ? `/${node.name}` : `${newParentPath}/${node.name}`;
        
        for(const file of draft.values()){
            if(file.path === newPath) {
                 throw new Error(`An item named "${node.name}" already exists in the destination.`);
            }
        }
        
        const oldPath = node.path;
        node.path = newPath;
        node.parentId = parentNode ? parentNode.id : null;
        node.modifiedAt = new Date().toISOString();

        if (node.type === 'folder') {
            for (const file of draft.values()) {
                if (file.path.startsWith(oldPath + '/')) {
                    const updatedPath = newPath + file.path.substring(oldPath.length);
                    const childNode = draft.get(file.id);
                    if (childNode) {
                        childNode.path = updatedPath;
                    }
                }
            }
        }
    }));
  }

  const getFolderPath = useCallback(() => {
    const folderPaths = ['/'];
    for(const file of files.values()){
        if(file.type === 'folder'){
            folderPaths.push(file.path);
        }
    }
    return folderPaths.sort();
  }, [files]);
  
  const currentFiles = useMemo(() => {
    const filesInCurrentDir = Array.from(files.values()).filter(file => {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
      return parentPath === currentPath;
    });

    const filtered = searchTerm
      ? filesInCurrentDir.filter((file) =>
          file.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : filesInCurrentDir;

    return [...filtered].sort((a, b) => {
      if (a.type === 'folder' && b.type !== 'folder') return -1;
      if (a.type !== 'folder' && b.type === 'folder') return 1;

      const valA = a[sortConfig.key];
      const valB = b[sortConfig.key];
      
      let comparison = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      }
      
      return sortConfig.direction === 'ascending' ? comparison : -comparison;
    });
  }, [files, currentPath, searchTerm, sortConfig]);

  return {
    files,
    currentPath,
    currentFiles,
    changeDirectory,
    createNode,
    deleteNode,
    renameNode,
    moveNode,
    getFolderPath,
    search,
    searchTerm,
    isLoading,
    sortConfig,
    setSortConfig,
    uploadFile,
  };
}

    