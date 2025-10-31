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
  ArrowUpDown,
  LayoutGrid,
  List,
  Upload,
  Home,
  Download,
  Video,
  Music,
  Camera,
  Monitor,
  Settings,
  Info
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
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
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarSeparator,
} from './ui/sidebar';
import { SheetTitle } from './ui/sheet';

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
    getFolderPath
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
    if (!actionType || (!actionNode && ['rename', 'delete', 'move'].includes(actionType))) return;

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
    if(event.target) {
        event.target.value = '';
    }
  };
  
  const handleItemClick = (file: FileNode) => {
    if (file.type === 'folder') {
      changeDirectory(file.path);
    } else if (['image', 'text', 'pdf'].includes(file.type)) {
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
  
  const FileListItem = ({ file }: { file: FileNode }) => (
    <TableRow
      className="cursor-pointer"
      onDoubleClick={() => handleItemClick(file)}
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
  );

  const renderListView = () => (
    <Table>
      <TableHeader>
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
        currentFiles.map(file => <FileListItem key={file.id} file={file} />)
        }
      </TableBody>
    </Table>
  );
  
  const FileGridItem = ({ file }: { file: FileNode }) => (
    <Card
        className="cursor-pointer group relative"
        onDoubleClick={() => handleItemClick(file)}
    >
        <CardContent className="p-0 aspect-square flex flex-col items-center justify-center text-center">
            {file.type === 'image' && file.url ? (
                <Image src={file.url} alt={file.name} fill={true} style={{objectFit:"cover"}} className="rounded-t-lg" />
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
  );

  const renderGridView = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 p-4">
    {isLoading ? Array(8).fill(0).map((_, i) => (
      <Card key={i}><CardContent className="p-4 aspect-square flex flex-col items-center justify-center"><Skeleton className="h-12 w-12 mb-2" /><Skeleton className="h-4 w-20" /></CardContent></Card>
    )) :
    currentFiles.map(file => <FileGridItem key={file.id} file={file}/>)
    }
    </div>
  );
  
  const MobileListItem = ({ file }: { file: FileNode }) => (
    <Card onDoubleClick={() => handleItemClick(file)}>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden" onClick={() => handleItemClick(file)}>
          <FileTypeIcon type={file.type} />
          <div className="flex flex-col overflow-hidden">
            <span className="font-medium truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(file.modifiedAt), { addSuffix: true })}</span>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
            {renderActionsDropdown(file)}
        </div>
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
    currentFiles.map(file => <MobileListItem key={file.id} file={file}/>)
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
                    This will permanently delete "{actionNode?.name}". This action cannot be undone.
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

  const handleSidebarClick = (path: string) => {
    if(folderPaths.includes(path)) {
      changeDirectory(path);
    } else {
      toast({
        title: "Info",
        description: `Navigation to "${path}" is not implemented yet.`,
      })
    }
  }

  const menuItems = [
    { icon: Home, label: 'Wurzel', path: '/' },
    { icon: Camera, label: 'DCIM', path: '/Pictures' },
    { icon: Download, label: 'Downloads', path: '/' },
    { icon: Video, label: 'Videos', path: '/' },
    { icon: Music, label: 'Musik', path: '/' },
    { icon: ImageIcon, label: 'Bilder', path: '/Pictures' },
    { icon: Monitor, label: 'Screenshots', path: '/Pictures' },
  ];

  const settingsItems = [
    { icon: Settings, label: 'Einstellungen', path: '/' },
    { icon: Info, label: 'Über', path: '/' },
  ];

  const [isSearchVisible, setIsSearchVisible] = useState(false);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
           <div className="p-2">
            <h2 className="text-lg font-semibold">Interner Speicher</h2>
            <p className="text-xs text-muted-foreground">43.34 GB frei von 116 GB</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  onClick={() => handleSidebarClick(item.path)}
                  isActive={currentPath === item.path && item.path !== '/'}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <SidebarSeparator/>
          <SidebarMenu>
            {settingsItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  onClick={() => handleSidebarClick(item.path)}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <ThemeToggle />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <div className="h-full w-full flex flex-col bg-background text-foreground relative">
          <header className="flex-shrink-0 flex items-center justify-between p-2 md:p-4 border-b">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <div className="flex flex-col">
                <h1 className="text-lg font-bold">
                    {currentPath === '/'
                    ? 'Dateien'
                    : currentPath.split('/').pop()}
                </h1>
                <p className="text-xs text-muted-foreground">{currentFiles.length} Dateien</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
               <Button variant="ghost" size="icon" onClick={() => setIsSearchVisible(!isSearchVisible)}>
                 <Search className="h-5 w-5" />
               </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <List className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Sortieren nach</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuItem onClick={() => handleSort('name')}>Name</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSort('modifiedAt')}>Datum</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSort('size')}>Größe</DropdownMenuItem>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {!isMobile && (
                            <div className="p-2">
                                <ToggleGroup
                                    type="single"
                                    value={viewMode}
                                    onValueChange={(value) => value && setViewMode(value as ViewMode)}
                                    className="w-full"
                                >
                                    <ToggleGroupItem value="list" aria-label="List view" className="w-1/2">
                                    <List className="h-4 w-4 mr-2" />
                                    Liste
                                    </ToggleGroupItem>
                                    <ToggleGroupItem value="grid" aria-label="Grid view" className="w-1/2">
                                    <LayoutGrid className="h-4 w-4 mr-2" />
                                    Gitter
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

               <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                            <AiSuggestionDialog />
                        </DropdownMenuItem>
                         <DropdownMenuItem onClick={() => toast({title: "Not implemented"})}>
                            Ordner ausblenden
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast({title: "Not implemented"})}>
                            Einstellungen
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </header>

          {isSearchVisible && (
            <div className="p-2 md:p-4 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Suchen..."
                  className="pl-9 w-full"
                  value={searchTerm}
                  onChange={(e) => search(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="p-2 border-b">
            <h3 className="text-sm font-semibold text-muted-foreground">Interner Speicher</h3>
          </div>

          <ScrollArea className="flex-1">
            {isMobile
              ? renderMobileView()
              : viewMode === 'grid'
              ? renderGridView()
              : renderListView()}
          </ScrollArea>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="absolute bottom-6 right-6 h-14 w-14 rounded-full shadow-lg" size="icon">
                    <Plus className="h-6 w-6" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
                <DropdownMenuItem onClick={() => openActionDialog('create-folder', null)}>
                    Neuer Ordner
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openActionDialog('create-file', null)}>
                    Neue Datei
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    Hochladen
                </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          <Dialog
            open={!!actionType}
            onOpenChange={(open) => !open && closeActionDialog()}
          >
            <DialogContent>
              <ActionDialogContent />
            </DialogContent>
          </Dialog>

          <Dialog
            open={!!previewFile}
            onOpenChange={(open) => !open && setPreviewFile(null)}
          >
            <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{previewFile?.name}</DialogTitle>
                <DialogDescription>
                  {previewFile?.type} - {formatSize(previewFile?.size || 0)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto my-4">
                {previewFile?.type === 'image' && previewFile.url && (
                  <Image
                    src={previewFile.url}
                    alt={previewFile.name}
                    width={1200}
                    height={800}
                    className="w-full h-auto object-contain"
                  />
                )}
                {previewFile?.type === 'text' && (
                  <pre className="text-sm whitespace-pre-wrap">
                    {previewFile.content}
                  </pre>
                )}
                {previewFile?.type === 'pdf' && previewFile.url && (
                  <iframe src={previewFile.url} className="w-full h-full" />
                )}
                {previewFile?.type === 'pdf' && !previewFile.url && (
                  <p className="text-center text-muted-foreground p-8">
                    PDF preview is not yet implemented.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => setPreviewFile(null)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}