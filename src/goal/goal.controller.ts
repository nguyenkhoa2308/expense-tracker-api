import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GoalService } from './goal.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContributionDto } from './dto/create-contribution.dto';

@ApiTags('goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalController {
  constructor(private readonly goalService: GoalService) {}

  @Post()
  @ApiOperation({ summary: 'Create new goal' })
  create(
    @Request() req: { user: { id: string } },
    @Body() createGoalDto: CreateGoalDto,
  ) {
    return this.goalService.create(req.user.id, createGoalDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals' })
  findAll(@Request() req: { user: { id: string } }) {
    return this.goalService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get goal by ID' })
  findOne(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.goalService.findOne(id, req.user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update goal' })
  update(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() updateGoalDto: UpdateGoalDto,
  ) {
    return this.goalService.update(id, req.user.id, updateGoalDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete goal' })
  remove(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.goalService.remove(id, req.user.id);
  }

  @Post(':id/contribution')
  @ApiOperation({ summary: 'Add contribution to goal' })
  addContribution(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
    @Body() data: CreateContributionDto,
  ) {
    return this.goalService.addContribution(id, req.user.id, data.amount);
  }
}
