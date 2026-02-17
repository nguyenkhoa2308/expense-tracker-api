import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecurringService } from './recurring.service';
import { CreateRecurringDto } from './dto/create-recurring.dto';
import { UpdateRecurringDto } from './dto/update-recurring.dto';

@ApiTags('recurring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring')
export class RecurringController {
  constructor(private readonly service: RecurringService) {}

  @Post()
  @ApiOperation({ summary: 'Create recurring transaction' })
  create(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateRecurringDto,
  ) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all recurring transactions' })
  findAll(@Request() req: { user: { id: string } }) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recurring transaction by ID' })
  findOne(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.service.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update recurring transaction' })
  update(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateRecurringDto,
  ) {
    return this.service.update(id, req.user.id, dto);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle active/inactive' })
  toggle(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.service.toggleActive(id, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete recurring transaction' })
  remove(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.service.remove(id, req.user.id);
  }
}
