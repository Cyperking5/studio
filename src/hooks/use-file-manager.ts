"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { initialFiles } from '@/lib/data';
import type { FileNode, FileType, SortConfig } from '@/lib/types';

const findNodeByPath = (files: FileNode[], path: string): FileNode | null => {
    if (path === '/') return null;
    for (const file of files) {
        if (file.path === path) {
            return file;
        }
    }
    return null;
};

const getFileType = (file: File): FileType => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('text/')) return 'text';
    return 'other';
}

export function useFileManager() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setFiles(initialFiles);
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const changeDirectory = useCallback((path: string) => {
    setSearchTerm('');
    setCurrentPath(path);
  }, []);

  const search = useCallback((term: string) => {
    setSearchTerm(term);
  }, []);

  const createNode = (name: string, type: FileType) => {
    if (!name) throw new Error("Name cannot be empty.");
    
    const parentNode = findNodeByPath(files, currentPath);
    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    
    if (files.some(f => f.path === newPath)) {
      throw new Error(`A file or folder with the name "${name}" already exists.`);
    }

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
    setFiles(prevFiles => [...prevFiles, newNode]);
  };

  const uploadFile = (file: File) => {
    const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
    if (files.some(f => f.path === newPath)) {
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
        setFiles(prevFiles => {
            const nodeToUpdate = prevFiles.find(f => f.id === newNode.id);
            if (nodeToUpdate) {
                if (fileType === 'image') nodeToUpdate.url = result;
                else if (fileType === 'text') nodeToUpdate.content = result.split(',')[1] ? atob(result.split(',')[1]) : '';
            }
            return [...prevFiles];
        });
    };

    if (fileType === 'image' || fileType === 'text') {
        reader.readAsDataURL(file);
    }
    setFiles(prevFiles => [...prevFiles, newNode]);
  };

  const renameNode = (id: string, newName: string) => {
    if (!newName) throw new Error("Name cannot be empty.");

    let targetNode: FileNode | null = null;
    for(const f of files) {
        if(f.id === id) {
            targetNode = f;
            break;
        }
    }
    if (!targetNode) return;

    const parentPath = targetNode.path.substring(0, targetNode.path.lastIndexOf('/')) || '/';
    const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

    if (files.some(f => f.path === newPath && f.id !== id)) {
      throw new Error(`An item named "${newName}" already exists.`);
    }
    
    const oldPath = targetNode.path;
    
    setFiles(prevFiles => {
        const updatedFiles = prevFiles.map(f => {
            if (f.id === id) {
                return { ...f, name: newName, path: newPath, modifiedAt: new Date().toISOString() };
            }
            if (f.path.startsWith(oldPath + '/')) {
                return { ...f, path: newPath + f.path.substring(oldPath.length) };
            }
            return f;
        });
        return updatedFiles;
    });
  };

  const deleteNode = (id: string) => {
    const nodeToDelete = files.find(f => f.id === id);
    if (!nodeToDelete) return;
  
    const idsToDelete = new Set<string>([id]);
  
    if (nodeToDelete.type === 'folder') {
      const findChildrenRecursive = (parentId: string) => {
        files.forEach(file => {
          if (file.parentId === parentId) {
            idsToDelete.add(file.id);
            if (file.type === 'folder') {
              findChildrenRecursive(file.id);
            }
          }
        });
      };
      findChildrenRecursive(id);
    }
  
    setFiles(prevFiles => prevFiles.filter(f => !idsToDelete.has(f.id)));
  };

  const moveNode = (id: string, newParentPath: string) => {
    const node = files.find(n => n.id === id);
    if (!node) return;

    const parentNode = findNodeByPath(files, newParentPath);
    if (newParentPath !== '/' && !parentNode) {
        throw new Error("Destination folder does not exist.");
    }
    
    if (node.type === 'folder' && (newParentPath === node.path || newParentPath.startsWith(node.path + '/'))) {
      throw new Error("Cannot move a folder into itself.");
    }

    const newPath = newParentPath === '/' ? `/${node.name}` : `${newParentPath}/${node.name}`;

    if (files.some(f => f.path === newPath && f.id !== id)) {
        throw new Error(`An item named "${node.name}" already exists in the destination.`);
    }

    const oldPath = node.path;
    
    setFiles(prevFiles => {
        const updatedFiles = prevFiles.map(f => {
            if (f.id === id) {
                return { ...f, parentId: parentNode ? parentNode.id : null, path: newPath, modifiedAt: new Date().toISOString() };
            }
            if (f.path.startsWith(oldPath + '/')) {
                return { ...f, path: newPath + f.path.substring(oldPath.length) };
            }
            return f;
        });
        return updatedFiles;
    });
  };

  const getFolderPath = useCallback(() => {
    return ['/', ...files.filter(f => f.type === 'folder').map(f => f.path)].sort();
  }, [files]);

  const currentFiles = useMemo(() => {
    const parentNode = findNodeByPath(files, currentPath);
    const filesInCurrentDir = files.filter(file => file.parentId === (parentNode ? parentNode.id : null));
    
    const filtered = searchTerm ? filesInCurrentDir.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())) : filesInCurrentDir;

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
