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
import React, { useState, useRef, useMemo } from 'react';
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
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
    deleteNode,
    renameNode,
    moveNode,
    search,
    searchTerm,
    isLoading,
    sortConfig,
    setSortConfig,
    uploadFile,
    getFolderPath,
  } = useFileManager();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          if (actionNode) {
            deleteNode(actionNode.id);
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
    // Reset file input
    if(event.target) {
        event.target.value = '';
    }
  };
  
  const handleFileClick = (file: FileNode) => {
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
                }).catch((error) => console.error('Error sharing:', error));
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

  const renderListView = () => (
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
        currentFiles.map((file) => (
          <TableRow key={file.id} onDoubleClick={() => handleFileClick(file)} className="cursor-pointer" onClick={isMobile ? () => handleFileClick(file) : undefined}>
            <TableCell>
              <div className="flex items-center gap-3">
                <FileTypeIcon type={file.type} />
                <span className="font-medium">{file.name}</span>
              </div>
            </TableCell>
            <TableCell>{formatDistanceToNow(new Date(file.modifiedAt), { addSuffix: true })}</TableCell>
            <TableCell>{file.type !== 'folder' ? formatSize(file.size) : '-'}</TableCell>
            <TableCell className="text-right">{renderActionsDropdown(file)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4">
    {isLoading ? Array(8).fill(0).map((_, i) => (
      <Card key={i}><CardContent className="p-4 aspect-square flex flex-col items-center justify-center"><Skeleton className="h-12 w-12 mb-2" /><Skeleton className="h-4 w-20" /></CardContent></Card>
    )) :
    currentFiles.map((file) => (
      <Card key={file.id} onDoubleClick={() => handleFileClick(file)} className="cursor-pointer group relative active:bg-secondary" onClick={() => handleFileClick(file)}>
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
    ))}
    </div>
  );
  
  const renderMobileView = () => (
    <ScrollArea className="h-full">
        <div className="p-4 grid gap-4">
        {isLoading ? Array(5).fill(0).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
        )) :
        currentFiles.map((file) => (
            <Card key={file.id} onClick={() => handleFileClick(file)} className="active:bg-secondary">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <FileTypeIcon type={file.type} />
                        <div className="flex flex-col overflow-hidden">
                            <span className="font-medium truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(file.modifiedAt), { addSuffix: true })} {file.type !== 'folder' ? `• ${formatSize(file.size)}` : ''}</span>
                        </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>{renderActionsDropdown(file)}</div>
                </CardContent>
            </Card>
        ))}
        </div>
    </ScrollArea>
  );

  return (
    <div className="flex flex-col h-full bg-background text-foreground rounded-lg">
      <header className="p-4 border-b flex-shrink-0">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="text-2xl font-bold tracking-tight">FileSurfer</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AiSuggestionDialog />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> New
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openActionDialog('create-folder', null)}>
                  <Folder className="mr-2 h-4 w-4" /> New Folder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openActionDialog('create-file', null)}>
                  <FileIcon className="mr-2 h-4 w-4" /> New File
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Upload File
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search in this folder..." className="pl-9" value={searchTerm} onChange={(e) => search(e.target.value)} />
        </div>
        {!isMobile && (
          <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)} defaultValue="list">
              <ToggleGroupItem value="list" aria-label="List view">
                  <List className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid" aria-label="Grid view">
                  <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
          </ToggleGroup>
        )}
        </div>
      </header>
      
      <nav className="p-4 border-b flex-shrink-0">
        {renderBreadcrumbs()}
      </nav>

      <div className="flex-grow overflow-hidden">
        <ScrollArea className="h-full">
            {isMobile ? renderMobileView() : (viewMode === 'list' ? renderListView() : renderGridView())}
        </ScrollArea>
      </div>

      <Dialog open={!!actionType && ['create-folder', 'create-file', 'rename'].includes(actionType as string)} onOpenChange={(isOpen) => !isOpen && closeActionDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'create-folder' && 'Create New Folder'}
                {actionType === 'create-file' && 'Create New File'}
                {actionType === 'rename' && `Rename "${actionNode?.name}"`}
              </DialogTitle>
            </DialogHeader>
            <Input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="Enter name..." onKeyDown={(e) => e.key === 'Enter' && handleAction()} />
            <DialogFooter>
              <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
              <Button onClick={handleAction}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
      
       <Dialog open={actionType === 'move'} onOpenChange={(isOpen) => !isOpen && closeActionDialog()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Move "{actionNode?.name}"</DialogTitle>
            </DialogHeader>
            <div>
                <p className="mb-2 text-sm text-muted-foreground">Select destination folder:</p>
                <ScrollArea className="h-40 border rounded-md">
                    <div className="p-2">
                    {folderPaths.map(path => (
                       <button key={path} onClick={() => setMoveToPath(path)} className={`w-full text-left p-2 rounded-md ${moveToPath === path ? 'bg-primary/20' : 'hover:bg-secondary'}`}>{path}</button>
                    ))}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
                <Button onClick={handleAction} disabled={!moveToPath}>Move</Button>
            </DialogFooter>
        </DialogContent>
       </Dialog>
      
      <Dialog open={actionType === 'delete'} onOpenChange={(isOpen) => !isOpen && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This will permanently delete "{actionNode?.name}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeActionDialog}>Cancel</Button>
            <Button variant="destructive" onClick={handleAction}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl w-full h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewFile?.name}</DialogTitle>
            <DialogDescription>
              {previewFile?.type} • {formatSize(previewFile?.size || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-grow overflow-auto my-4 rounded-md border bg-secondary/50">
            {previewFile?.type === 'image' && previewFile.url && (
              <div className="relative w-full h-full">
                <Image src={previewFile.url} alt={previewFile.name} fill={true} objectFit="contain" />
              </div>
            )}
            {previewFile?.type === 'text' && (
              <ScrollArea className="w-full h-full p-4">
                  <pre className="text-sm whitespace-pre-wrap">{previewFile.content}</pre>
              </ScrollArea>
            )}
            {previewFile?.type === 'pdf' && (
              <div className="flex items-center justify-center h-full flex-col gap-4 text-muted-foreground">
                <FileText className="w-16 h-16"/>
                <p>PDF preview is not available in this demo.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewFile(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
