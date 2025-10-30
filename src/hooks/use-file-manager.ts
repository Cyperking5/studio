"use client";

import { useState, useEffect, useMemo } from 'react';
import { initialFiles } from '@/lib/data';
import type { FileNode, FileType, SortConfig } from '@/lib/types';

const findNodeByPath = (files: FileNode[], path: string): FileNode | null => {
    if (path === '/') return null;
    return files.find(file => file.path === path) || null;
}

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

    setFiles(prev => [...prev, newNode]);
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
        setFiles(prevFiles => prevFiles.map(f => {
            if (f.id === newNode.id) {
                const updatedNode = {...f};
                if (fileType === 'image') updatedNode.url = result;
                else if (fileType === 'text') updatedNode.content = result.split(',')[1] ? atob(result.split(',')[1]) : '';
                return updatedNode;
            }
            return f;
        }));
    };

    if (fileType === 'image' || fileType === 'text') {
        reader.readAsDataURL(file);
    }
    
    setFiles(prev => [...prev, newNode]);
  };

  const renameNode = (id: string, newName: string) => {
    if (!newName) throw new Error("Name cannot be empty.");
    let targetNode: FileNode | undefined;
    let oldPath: string | undefined;

    setFiles(prev => {
        const nextState = [...prev];
        targetNode = nextState.find(f => f.id === id);
        if (!targetNode) return prev;

        const parentPath = targetNode.path.substring(0, targetNode.path.lastIndexOf('/')) || '/';
        const newPath = parentPath === '/' ? `/${newName}` : `${parentPath}/${newName}`;

        if (nextState.some(f => f.path === newPath && f.id !== id)) {
            throw new Error(`An item named "${newName}" already exists.`);
        }
        oldPath = targetNode.path;
        targetNode.name = newName;
        targetNode.path = newPath;
        targetNode.modifiedAt = new Date().toISOString();

        // If it's a folder, update paths of all children
        if (targetNode.type === 'folder' && oldPath) {
            return nextState.map(file => {
                if (file.path.startsWith(oldPath + '/')) {
                    return { ...file, path: newPath + file.path.substring(oldPath.length) };
                }
                return file;
            });
        }
        return nextState;
    });
  };
  
  const deleteNode = (id: string) => {
    setFiles(prev => {
      const nodeToDelete = prev.find(f => f.id === id);
      if (!nodeToDelete) return prev;

      if (nodeToDelete.type === 'folder') {
        const childrenPaths = prev.filter(f => f.path.startsWith(nodeToDelete.path + '/')).map(f => f.path);
        return prev.filter(f => f.id !== id && !childrenPaths.some(p => f.path.startsWith(p)));
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const moveNode = (id: string, newParentPath: string) => {
    setFiles(prev => {
        const node = prev.find(n => n.id === id);
        if (!node) return prev;

        const parentNode = findNodeByPath(prev, newParentPath);
        if (newParentPath !== '/' && !parentNode) {
            throw new Error("Destination folder does not exist.");
        }
        
        if (node.type === 'folder' && newParentPath.startsWith(node.path)) {
            throw new Error("Cannot move a folder into itself.");
        }

        const newPath = newParentPath === '/' ? `/${node.name}` : `${newParentPath}/${node.name}`;

        if (prev.some(f => f.path === newPath)) {
            throw new Error(`An item named "${node.name}" already exists in the destination.`);
        }

        const oldPath = node.path;

        const updatedFiles = prev.map(f => {
            if (f.id === id) {
                return { ...f, path: newPath, parentId: parentNode ? parentNode.id : null, modifiedAt: new Date().toISOString() };
            }
            if (node.type === 'folder' && f.path.startsWith(oldPath + '/')) {
                return { ...f, path: newPath + f.path.substring(oldPath.length) };
            }
            return f;
        });

        return updatedFiles;
    });
  };

  const getFolderPath = () => {
    return ['/', ...files.filter(f => f.type === 'folder').map(f => f.path)].sort();
  }

  const currentFiles = useMemo(() => {
    const parentId = findNodeByPath(files, currentPath)?.id || null;
    const filesInCurrentDir = files.filter(file => file.parentId === parentId);
    
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
