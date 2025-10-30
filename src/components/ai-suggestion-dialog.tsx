"use client";

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { suggestFileLocation, type SuggestFileLocationOutput } from '@/ai/flows/suggest-file-location';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  fileName: z.string().min(1, 'File name is required.'),
  fileType: z.string().min(1, 'File type is required.'),
  fileDescription: z.string().min(1, 'Description is required.'),
});

type AiSuggestionFormValues = z.infer<typeof formSchema>;

export function AiSuggestionDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<SuggestFileLocationOutput | null>(null);
  const { toast } = useToast();

  const form = useForm<AiSuggestionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fileName: '',
      fileType: '',
      fileDescription: '',
    },
  });

  const onSubmit = (values: AiSuggestionFormValues) => {
    setSuggestion(null);
    startTransition(async () => {
      const result = await suggestFileLocation(values);
      if (result) {
        setSuggestion(result);
      } else {
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to get suggestion. Please try again.",
        });
      }
    });
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        form.reset();
        setSuggestion(null);
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="mr-2 h-4 w-4" />
          AI Suggestion
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>AI File Location Suggestion</DialogTitle>
          <DialogDescription>
            Describe your file, and our AI will suggest the best place to store it.
          </DialogDescription>
        </DialogHeader>
        {suggestion ? (
            <div className="space-y-4 py-4">
                <h3 className="font-semibold">Suggestion Result:</h3>
                <div className="p-4 bg-secondary rounded-md space-y-2">
                    <p><span className="font-medium text-muted-foreground">Suggested Path:</span> <code className="font-semibold">{suggestion.suggestedLocation}</code></p>
                    <p><span className="font-medium text-muted-foreground">Reasoning:</span> {suggestion.reasoning}</p>
                </div>
                 <Button onClick={() => setSuggestion(null)} className="w-full">
                    Try another
                </Button>
            </div>
        ) : (
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                control={form.control}
                name="fileName"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>File Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., q4-earnings-report.pdf" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="fileType"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>File Type</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., PDF, Image, Document" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="fileDescription"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>File Description</FormLabel>
                    <FormControl>
                        <Textarea placeholder="A brief summary of the file's content." {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <DialogFooter>
                    <Button type="submit" disabled={isPending} className="w-full">
                        {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Get Suggestion
                        </>
                        )}
                    </Button>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
