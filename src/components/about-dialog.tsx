"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { ScrollArea } from "./ui/scroll-area"
import { Imprint } from "./imprint"
import { PrivacyPolicy } from "./privacy-policy"

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Über FileSurfer</DialogTitle>
          <DialogDescription>
            Version 1.1.0
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="imprint" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="imprint">Impressum</TabsTrigger>
            <TabsTrigger value="privacy">Datenschutzerklärung</TabsTrigger>
          </TabsList>
          <TabsContent value="imprint">
            <ScrollArea className="h-96 pr-4">
              <Imprint />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="privacy">
             <ScrollArea className="h-96 pr-4">
              <PrivacyPolicy />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
