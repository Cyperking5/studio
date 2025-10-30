'use server';

/**
 * @fileOverview This file contains the Genkit flow for suggesting file locations based on file metadata.
 *
 * It includes:
 * - suggestFileLocation: A function to suggest the best location for a file.
 * - SuggestFileLocationInput: The input type for the suggestFileLocation function.
 * - SuggestFileLocationOutput: The output type for the suggestFileLocation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestFileLocationInputSchema = z.object({
  fileName: z.string().describe('The name of the file.'),
  fileType: z.string().describe('The type of the file (e.g., document, image, etc.).'),
  fileDescription: z.string().describe('A description of the file content.'),
  currentLocation: z.string().optional().describe('The current location of the file, if any.'),
});
export type SuggestFileLocationInput = z.infer<typeof SuggestFileLocationInputSchema>;

const SuggestFileLocationOutputSchema = z.object({
  suggestedLocation: z.string().describe('The suggested location for the file.'),
  reasoning: z.string().describe('The reasoning behind the suggested location.'),
});
export type SuggestFileLocationOutput = z.infer<typeof SuggestFileLocationOutputSchema>;

export async function suggestFileLocation(input: SuggestFileLocationInput): Promise<SuggestFileLocationOutput> {
  return suggestFileLocationFlow(input);
}

const suggestFileLocationPrompt = ai.definePrompt({
  name: 'suggestFileLocationPrompt',
  input: {schema: SuggestFileLocationInputSchema},
  output: {schema: SuggestFileLocationOutputSchema},
  prompt: `You are an AI assistant designed to suggest the best location for a file within a file system.

  Given the following file metadata, determine the most appropriate location for the file.
  Consider existing folder structures and naming conventions.

  File Name: {{{fileName}}}
  File Type: {{{fileType}}}
  File Description: {{{fileDescription}}}
  Current Location: {{{currentLocation}}}

  Respond with the suggested location and a brief explanation of why that location is suitable.
  Ensure the suggested path is absolute-like (e.g., /documents/projects/file.txt).
  The reasoning should be short and explain why the directory was chosen.
`,
});

const suggestFileLocationFlow = ai.defineFlow(
  {
    name: 'suggestFileLocationFlow',
    inputSchema: SuggestFileLocationInputSchema,
    outputSchema: SuggestFileLocationOutputSchema,
  },
  async input => {
    const {output} = await suggestFileLocationPrompt(input);
    return output!;
  }
);
