"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { initialFiles } from '@/lib/data';
import type { FileNode, FileType } from '@/lib/types';
import { produce } from 'immer';

export function useFileManager() {
  const [files, setFiles] = useState<Map<string, FileNode>>(new Map());
  const [currentPath, setCurrentPath] = useState('/');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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

  const getParentIdForPath = (path: string): string | null => {
    if (path === '/') return null;
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
    for (const file of files.values()) {
        if (file.path === parentPath) {
            return file.id;
        }
    }
    return null;
  }

  const createNode = (name: string, type: FileType) => {
    if (!name) throw new Error("Name cannot be empty.");

    const newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    
    for (const file of files.values()) {
        if (file.path === newPath) {
            throw new Error(`A file or folder with the name "${name}" already exists.`);
        }
    }
    
    const newId = new Date().getTime().toString();
    const parentId = getParentIdForPath(currentPath);

    const newNode: FileNode = {
      id: newId,
      name,
      type,
      path: newPath,
      parentId,
      modifiedAt: new Date().toISOString(),
      size: 0,
      content: type === 'text' ? '' : undefined,
    };

    setFiles(produce(draft => {
      draft.set(newId, newNode);
    }));
  };

  const renameNode = (id: string, newName: string) => {
    if (!newName) throw new Error("Name cannot be empty.");

    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;

        const parentPath = node.path.substring(0, node.path.lastIndexOf('/')) || '';
        const newPath = parentPath === '' ? `/${newName}` : `${parentPath}/${newName}`;

        // Check for name collision
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
                    const updatedPath = newPath + file.path.substring(oldPath.length);
                    const childNode = draft.get(file.id);
                    if (childNode) {
                        childNode.path = updatedPath;
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

        const nodesToDelete = [id];
        if (node.type === 'folder') {
            for (const file of draft.values()) {
                if(file.path.startsWith(node.path + '/')) {
                    nodesToDelete.push(file.id);
                }
            }
        }
        nodesToDelete.forEach(deleteId => draft.delete(deleteId));
    }));
  };

  const moveNode = (id: string, newParentPath: string) => {
    setFiles(produce(draft => {
        const node = draft.get(id);
        if (!node) return;

        const newPath = newParentPath === '/' ? `/${node.name}` : `${newParentPath}/${node.name}`;
        
        for (const file of draft.values()) {
            if (file.path === newPath && file.id !== id) {
                throw new Error(`An item named "${node.name}" already exists in the destination.`);
            }
        }
        
        const newParentId = getParentIdForPath(newParentPath);

        const oldPath = node.path;
        node.path = newPath;
        node.parentId = newParentId;
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
      const isRootFile = !file.path.includes('/') && currentPath === '/';
      const isRootFileWithSlash = file.path.lastIndexOf('/') === 0 && currentPath === '/';
      return parentPath === currentPath || isRootFile || isRootFileWithSlash;
    });

    const filtered = searchTerm
      ? filesInCurrentDir.filter((file) =>
          file.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : filesInCurrentDir;

    return filtered.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
  }, [files, currentPath, searchTerm]);

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
    isLoading
  };
}
