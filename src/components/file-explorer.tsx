"use client";

import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
  File as FileIcon,
  FileText,
  Folder,
  ImageIcon,
  MoreVertical,
  Search,
  Plus,
  Trash2,
  Copy,
  Move,
  Share2,
  PenSquare,
  Home,
  ChevronRight,
  ArrowUpDown,
  LayoutGrid,
  List,
  Upload,
} from 'lucide-react';
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useFileManager } from '@/hooks/use-file-manager';
import { useIsMobile } from '@/hooks/use-mobile';
import type { FileNode, FileType, SortConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AiSuggestionDialog } from './ai-suggestion-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';

type ActionType = 'create-folder' | 'create-file' | 'rename' | 'delete' | 'move';
type ViewMode = 'list' | 'grid';

const FileTypeIcon = ({ type, className }: { type: FileType, className?: string }) => {
  const iconProps = { className: cn('w-5 h-5 text-muted-foreground', className) };
  switch (type) {
    case 'folder':
      return <Folder {...iconProps} fill="currentColor" />;
    case 'image':
      return <ImageIcon {...iconProps} />;
    case 'pdf':
      return <FileText {...iconProps} />;
    case 'text':
      return <FileText {...iconProps} />;
    default:
      return <FileIcon {...iconProps} />;
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function FileExplorer() {
  const {
    currentFiles,
    currentPath,
    changeDirectory,
    createNode,
    deleteNodes,
    renameNode,
    moveNode,
    search,
    searchTerm,
    isLoading,
    sortConfig,
    setSortConfig,
    uploadFile,
    getFolderPath,
    selection,
    toggleSelection,
    clearSelection,
    selectRange,
  } = useFileManager();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [actionNode, setActionNode] = useState<FileNode | null>(null);
  const [actionType, setActionType] = useState<ActionType | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [moveToPath, setMoveToPath] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  const openActionDialog = (type: ActionType, node: FileNode | null) => {
    setActionType(type);
    setActionNode(node);
    setInputValue(node?.name || '');
    if (type === 'move' && node) {
      const parentPath = node.path.substring(0, node.path.lastIndexOf('/')) || '/';
      setMoveToPath(parentPath);
    }
  };
  
  const closeActionDialog = () => {
    setActionType(null);
    setActionNode(null);
    setInputValue('');
    setMoveToPath('');
  };

  const handleAction = () => {
    if (!actionType) return;

    try {
      switch (actionType) {
        case 'create-folder':
          createNode(inputValue, 'folder');
          toast({ title: "Folder created", description: `"${inputValue}" has been created.` });
          break;
        case 'create-file':
          createNode(inputValue, 'text');
          toast({ title: "File created", description: `"${inputValue}" has been created.` });
          break;
        case 'rename':
          if (actionNode) {
            renameNode(actionNode.id, inputValue);
            toast({ title: "Renamed", description: `"${actionNode.name}" was renamed to "${inputValue}".` });
          }
          break;
        case 'delete':
          if (selection.size > 0) {
            deleteNodes([...selection]);
            toast({ title: "Deleted", description: `${selection.size} item(s) have been deleted.` });
          } else if (actionNode) {
            deleteNodes([actionNode.id]);
            toast({ title: "Deleted", description: `"${actionNode.name}" has been deleted.` });
          }
          break;
        case 'move':
            if (actionNode && moveToPath) {
                moveNode(actionNode.id, moveToPath);
                toast({ title: "Moved", description: `"${actionNode.name}" moved to ${moveToPath}.` });
            }
            break;
      }
    } catch (e) {
      const err = e as Error;
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
    closeActionDialog();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        uploadFile(file);
        toast({ title: "File uploaded", description: `"${file.name}" has been uploaded.` });
      } catch (e) {
        const err = e as Error;
        toast({ variant: "destructive", title: "Upload failed", description: err.message });
      }
    }
    if(event.target) {
        event.target.value = '';
    }
  };
  
  const handleItemClick = (e: React.MouseEvent, node: FileNode, index: number) => {
    if (e.ctrlKey || e.metaKey) {
      toggleSelection(node.id);
      setLastSelectedIndex(index);
    } else if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = currentFiles.slice(start, end + 1).map(f => f.id);
      selectRange(rangeIds);
    } else {
      clearSelection();
      toggleSelection(node.id);
      setLastSelectedIndex(index);
    }
  };

  const handleDoubleClick = (file: FileNode) => {
    if (file.type === 'folder') {
      changeDirectory(file.path);
    } else if (file.type === 'image' || file.type === 'text' || file.type === 'pdf') {
      setPreviewFile(file);
    } else {
        toast({ title: "Preview not available", description: `Cannot preview files of type "${file.type}".` });
    }
  };

  const handleSort = (key: SortConfig['key']) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key && prevConfig.direction === 'ascending') {
        return { key, direction: 'descending' };
      }
      return { key, direction: 'ascending' };
    });
  };

  const folderPaths = useMemo(() => getFolderPath(), [getFolderPath]);
  
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
        clearSelection();
        setLastSelectedIndex(null);
    }
  };

  const renderBreadcrumbs = () => (
    <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => changeDirectory('/')}>
        <Home className="h-4 w-4" />
      </Button>
      <ChevronRight className="h-4 w-4" />
      {currentPath === '/' ? (
        <span className="font-semibold text-foreground">Home</span>
      ) : (
        currentPath.substring(1).split('/').map((part, index, arr) => {
          const path = '/' + arr.slice(0, index + 1).join('/');
          const isLast = index === arr.length - 1;
          return (
            <React.Fragment key={path}>
              <Button
                variant="link"
                className={cn("text-base h-auto p-0", isLast ? "font-semibold text-foreground" : "")}
                onClick={() => !isLast && changeDirectory(path)}
              >
                {part}
              </Button>
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </React.Fragment>
          );
        })
      )}
    </div>
  );

  const renderContextMenuContent = (node: FileNode) => {
    const isMultiSelect = selection.size > 1;
    const isNodeSelected = selection.has(node.id);
    return (
      <>
        <ContextMenuItem
          onClick={() => openActionDialog('rename', node)}
          disabled={isMultiSelect}
        >
          <PenSquare className="mr-2 h-4 w-4" />
          <span>Rename</span>
        </ContextMenuItem>
        
        <ContextMenuItem
          onClick={() => openActionDialog('move', node)}
          disabled={isMultiSelect}
        >
            <Move className="mr-2 h-4 w-4" />
            <span>Move to</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => {
            if (navigator.share) {
                navigator.share({
                    title: node.name,
                    text: `Check out this file: ${node.name}`,
                }).catch(() => toast({variant: "destructive", title: "Sharing failed", description: "Could not share the file at this time."}));
            } else {
                toast({title: "Share not supported on this browser."})
            }
        }} disabled={isMultiSelect}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Share</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => toast({title: "Copy not implemented."})}>
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
          onClick={() => {
            if (!isNodeSelected) {
              clearSelection();
              toggleSelection(node.id);
            }
            openActionDialog('delete', node);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          <span>{isMultiSelect && isNodeSelected ? `Delete ${selection.size} items` : "Delete"}</span>
        </ContextMenuItem>
      </>
    );
  }

  const renderActionsDropdown = (node: FileNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openActionDialog('rename', node)}>
          <PenSquare className="mr-2 h-4 w-4" />
          <span>Rename</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => openActionDialog('move', node)}>
            <Move className="mr-2 h-4 w-4" />
            <span>Move to</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => {
            if (navigator.share) {
                navigator.share({
                    title: node.name,
                    text: `Check out this file: ${node.name}`,
                }).catch(() => toast({variant: "destructive", title: "Sharing failed", description: "Could not share the file at this time."}));
            } else {
                toast({title: "Share not supported on this browser."})
            }
        }}>
          <Share2 className="mr-2 h-4 w-4" />
          <span>Share</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast({title: "Copy not implemented."})}>
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => openActionDialog('delete', node)}>
          <Trash2 className="mr-2 h-4 w-4" />
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SortableHeader = ({ title, sortKey }: { title: string, sortKey: SortConfig['key'] }) => (
    <TableHead>
      <Button variant="ghost" onClick={() => handleSort(sortKey)} className="px-2">
        {title}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    </TableHead>
  );
  
  const FileListItem = ({ file, index }: { file: FileNode, index: number }) => (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          data-selected={selection.has(file.id)}
          className="cursor-pointer data-[selected=true]:bg-secondary"
          onClick={(e) => handleItemClick(e, file, index)}
          onDoubleClick={() => handleDoubleClick(file)}
        >
          <TableCell>
            <div className="flex items-center gap-3">
              <FileTypeIcon type={file.type} />
              <span className="font-medium">{file.name}</span>
            </div>
          </TableCell>
          <TableCell>{formatDistanceToNow(new Date(file.modifiedAt), { addSuffix: true })}</TableCell>
          <TableCell>{file.type !== 'folder' ? formatSize(file.size) : '-'}</TableCell>
          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>{renderActionsDropdown(file)}</TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>{renderContextMenuContent(file)}</ContextMenuContent>
    </ContextMenu>
  );

  const renderListView = () => (
    <div onClick={handleContainerClick} className="p-4 h-full">
    <Table>
      <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm">
        <TableRow>
          <SortableHeader title="Name" sortKey="name" />
          <SortableHeader title="Date Modified" sortKey="modifiedAt" />
          <SortableHeader title="File Size" sortKey="size" />
          <TableHead className="text-right w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? Array(5).fill(0).map((_, i) => (
          <TableRow key={i}>
              <TableCell><div className="flex items-center gap-3"><Skeleton className="h-5 w-5" /><Skeleton className="h-5 w-48" /></div></TableCell>
              <TableCell><Skeleton className="h-5 w-32" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
              <TableCell></TableCell>
          </TableRow>
        )) :
        currentFiles.map((file, index) => <FileListItem key={file.id} file={file} index={index} />)
        }
      </TableBody>
    </Table>
    </div>
  );
  
  const FileGridItem = ({ file, index }: { file: FileNode, index: number }) => (
      <ContextMenu>
          <ContextMenuTrigger asChild>
              <Card
                  data-selected={selection.has(file.id)}
                  className="cursor-pointer group relative active:bg-secondary data-[selected=true]:bg-secondary data-[selected=true]:shadow-lg"
                  onClick={(e) => handleItemClick(e, file, index)}
                  onDoubleClick={() => handleDoubleClick(file)}
              >
                  <CardContent className="p-0 aspect-square flex flex-col items-center justify-center text-center">
                      {file.type === 'image' && file.url ? (
                          <Image src={file.url} alt={file.name} fill={true} objectFit="cover" className="rounded-t-lg" />
                      ) : (
                          <FileTypeIcon type={file.type} className="w-12 h-12" />
                      )}
                  </CardContent>
                  <div className="p-2 border-t text-sm">
                    <p className="font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.type !== 'folder' ? formatSize(file.size) : '-'}</p>
                  </div>
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>{renderActionsDropdown(file)}</div>
              </Card>
          </ContextMenuTrigger>
          <ContextMenuContent>{renderContextMenuContent(file)}</ContextMenuContent>
      </ContextMenu>
  );

  const renderGridView = () => (
    <div onClick={handleContainerClick} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4">
    {isLoading ? Array(8).fill(0).map((_, i) => (
      <Card key={i}><CardContent className="p-4 aspect-square flex flex-col items-center justify-center"><Skeleton className="h-12 w-12 mb-2" /><Skeleton className="h-4 w-20" /></CardContent></Card>
    )) :
    currentFiles.map((file, index) => <FileGridItem key={file.id} file={file} index={index}/>)
    }
    </div>
  );
  
  const MobileListItem = ({ file, index }: { file: FileNode, index: number }) => (
    <Card
      data-selected={selection.has(file.id)}
      className="active:bg-secondary data-[selected=true]:bg-secondary"
      onClick={(e) => {
        if (selection.size > 0) {
          handleItemClick(e, file, index);
        }
      }}
      onLongPress={() => {
        if (!selection.has(file.id)) {
          toggleSelection(file.id);
        }
      }}
    >
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden" onClick={(e) => {
          if (selection.size === 0) {
            e.stopPropagation();
            handleDoubleClick(file);
          }
        }}>
          <FileTypeIcon type={file.type} />
          <div className="flex flex-col overflow-hidden">
            <span className="font-medium truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(file.modifiedAt), { addSuffix: true })}</span>
          </div>
        </div>
        {selection.size > 0 ? (
          <div
            className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center mr-2",
                selection.has(file.id) ? "bg-primary border-primary-foreground" : "border-muted-foreground"
            )}
          >
            {selection.has(file.id) && <div className="w-2 h-2 rounded-full bg-primary-foreground" />}
          </div>
        ) : (
            <div onClick={(e) => e.stopPropagation()}>
                {renderActionsDropdown(file)}
            </div>
        )}
      </CardContent>
    </Card>
  );

  const renderMobileView = () => (
    <div className="p-4 space-y-2">
    {isLoading ? Array(5).fill(0).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
            <Skeleton className="h-8 w-8" />
        </CardContent>
      </Card>
    )) :
    currentFiles.map((file, index) => <MobileListItem key={file.id} file={file} index={index}/>)
    }
    </div>
  );

  const ActionDialogContent = () => {
    switch (actionType) {
        case 'create-folder':
        case 'create-file':
        case 'rename':
            return (
            <>
                <DialogHeader>
                <DialogTitle>{actionType === 'rename' ? `Rename "${actionNode?.name}"` : actionType === 'create-folder' ? 'Create New Folder' : 'Create New File'}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                <Input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder={actionType.includes('folder') ? 'Folder name' : 'File name'} />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
                    <Button onClick={handleAction}>Save</Button>
                </DialogFooter>
            </>
            );
        case 'delete':
            return (
            <>
                <DialogHeader>
                <DialogTitle>Are you sure?</DialogTitle>
                <DialogDescription>
                    {selection.size > 1 ? `This will permanently delete ${selection.size} items.` : `This will permanently delete "${actionNode?.name}".`} This action cannot be undone.
                </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
                    <Button variant="destructive" onClick={handleAction}>Delete</Button>
                </DialogFooter>
            </>
            );
        case 'move':
            return (
            <>
                <DialogHeader>
                <DialogTitle>Move "{actionNode?.name}"</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-2">
                    <p className="text-sm">Select a destination folder:</p>
                    <select value={moveToPath} onChange={e => setMoveToPath(e.target.value)} className="w-full p-2 border rounded-md">
                        {folderPaths.map(path => <option key={path} value={path}>{path}</option>)}
                    </select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
                    <Button onClick={handleAction}>Move</Button>
                </DialogFooter>
            </>
            );
        default: return null;
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground">
      <header className="flex-shrink-0 flex items-center justify-between p-2 md:p-4 border-b">
        <div className="flex-1 min-w-0">
          {!isMobile && renderBreadcrumbs()}
          {isMobile && <h1 className="text-lg font-bold">FileSurfer</h1>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search..." className="pl-9 w-40 md:w-64" value={searchTerm} onChange={e => search(e.target.value)} />
          </div>
          <AiSuggestionDialog />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-shrink-0 flex items-center justify-between p-2 md:p-4 border-b">
        <div className="flex items-center gap-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> New</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => openActionDialog('create-folder', null)}>New Folder</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openActionDialog('create-file', null)}>New File</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-2"/> Upload</Button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

             {selection.size > 0 && (
                <Button variant="destructive" size="sm" onClick={() => openActionDialog('delete', null)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Delete ({selection.size})
                </Button>
            )}
        </div>
        {!isMobile && (
        <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)}>
            <ToggleGroupItem value="list" aria-label="List view"><List className="h-4 w-4"/></ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Grid view"><LayoutGrid className="h-4 w-4"/></ToggleGroupItem>
        </ToggleGroup>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isMobile ? renderMobileView() : viewMode === 'grid' ? renderGridView() : renderListView()}
      </ScrollArea>
      
      <Dialog open={!!actionType} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
            <ActionDialogContent />
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>{previewFile?.name}</DialogTitle>
                <DialogDescription>{previewFile?.type} - {formatSize(previewFile?.size || 0)}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-auto my-4">
                {previewFile?.type === 'image' && previewFile.url && <Image src={previewFile.url} alt={previewFile.name} width={1200} height={800} className="w-full h-auto object-contain" />}
                {previewFile?.type === 'text' && <pre className="text-sm whitespace-pre-wrap">{previewFile.content}</pre>}
                {previewFile?.type === 'pdf' && previewFile.url && <iframe src={previewFile.url} className="w-full h-full" />}
                {previewFile?.type === 'pdf' && !previewFile.url && <p className="text-center text-muted-foreground p-8">PDF preview is not yet implemented.</p>}
            </div>
            <DialogFooter>
                <Button onClick={() => setPreviewFile(null)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
