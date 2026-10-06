import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PROVIDERS } from '../llm/llm.catalog';

export class LlmOverrideDto {
  @IsOptional()
  @IsIn(['auto', ...Object.keys(PROVIDERS)])
  provider?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  apiKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  baseUrl?: string;
}

export class HistoryItemDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  @MaxLength(12_000)
  content: string;
}

export class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8_000)
  message: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HistoryItemDto)
  history?: HistoryItemDto[];

  @IsOptional()
  @IsIn(['standard', 'deep'])
  depth?: 'standard' | 'deep';

  @IsOptional()
  @ValidateNested()
  @Type(() => LlmOverrideDto)
  llm?: LlmOverrideDto;
}

export class LlmCheckDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LlmOverrideDto)
  llm?: LlmOverrideDto;
}
