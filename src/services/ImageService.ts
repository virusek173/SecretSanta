import OpenAI from 'openai';
import { GeneratedImage, IImageService } from '../types';

export const DEFAULT_IMAGE_MODEL = 'gpt-image-2';

/**
 * Service for generating AI-powered images using OpenAI GPT Image models
 */
export class ImageService implements IImageService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = DEFAULT_IMAGE_MODEL) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Generate a festive Christmas image based on giftee description.
   * GPT Image models always return the image inline as base64.
   */
  async generateImage(gifteeDescription: string): Promise<GeneratedImage> {
    try {
      const response = await this.openai.images.generate({
        model: this.model,
        prompt: createPrompt(gifteeDescription),
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        // JPEG keeps the email small (~200 KB instead of ~2 MB PNG)
        output_format: 'jpeg',
        output_compression: 85,
      });

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error('No image data returned by OpenAI');
      }

      return { data: Buffer.from(b64, 'base64'), mimeType: 'image/jpeg', extension: 'jpg' };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate image: ${error.message}`);
      }
      throw new Error('Failed to generate image: Unknown error');
    }
  }
}

/**
 * Create the prompt for the image model
 */
export function createPrompt(gifteeDescription: string): string {
  return `A festive Christmas illustration for Secret Santa gift exchange featuring elements related to: ${gifteeDescription}. Warm colors, cozy atmosphere, holiday theme, Christmas decorations. Artistic and cheerful style. No text or lettering in the image.`;
}
