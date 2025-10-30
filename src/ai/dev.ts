'use server';
/**
 * @fileOverview This file is the entry point for Genkit's development server.
 *
 * It imports the necessary flows so that they can be discovered and used by the Genkit framework.
 * This file should not contain any logic itself, but rather act as a central point for
 * importing and exposing the various AI flows defined in the application.
 */

import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-file-location.ts';
