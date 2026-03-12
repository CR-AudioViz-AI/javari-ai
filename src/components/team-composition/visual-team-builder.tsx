```tsx
'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  UniqueIdentifier
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy
} from '@dnd-kit/sortable'
import {
  useSortable,
  SortableContext as SortableProvider
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts'
import {
  Bot,
  Users,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Save,
  Plus,
  Trash2,
  Eye,
  Settings,
  Zap,
  Target,
  Clock,
  Award,
  BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Types
interface AIAgent {
  id: string
  name: string
  type: string
  capabilities: string[]
  cost_per_hour: number
  performance_score: number
  availability: number
  specializations: string[]
  experience_level: 'junior' | 'mid' | 'senior' | 'expert'
  metadata: Record<string, any>
}

interface RoleTemplate {
  id: string
  name: string
  description: string
  required_skills: string[]
  optional_skills: string[]
  min_experience_level: string
  estimated_hours: number
  priority: 'low' | 'medium' | 'high' | 'critical'
}

interface TeamMember {
  id: string
  agent: AIAgent
  role: string
  allocation: number
  position: { x: number; y: number }
}

interface TeamComposition {
  id?: string
  name: string
  description: string
  members: TeamMember[]
  created_at?: string
  updated_at?: string
}

interface SkillGap {
  skill: string
  required: boolean
  coverage: number
  agents: string[]
}

interface CostAnalysis {
  total_hourly_cost: number
  total_daily_cost: number
  total_monthly_cost: number
  cost_by_role: Record<string, number>
  optimization_suggestions: OptimizationSuggestion[]
}

interface OptimizationSuggestion {
  type: 'cost_reduction' | 'performance_improvement' | 'skill_gap'
  description: string
  impact: number
  priority: 'low' | 'medium' | 'high'
}

interface PerformancePrediction {
  overall_score: number
  timeline_efficiency: number
  quality_score: number
  collaboration_score: number
  risk_factors: string[]
  success_probability: number
}

interface VisualTeamBuilderProps {
  className?: string
  onTeamSave?: (team: TeamComposition) => void
  onTeamLoad?: (teamId: string) => void
  initialTeam?: TeamComposition
  availableAgents?: AIAgent[]
  roleTemplates?: RoleTemplate[]
}

// Draggable Agent Card Component
const DraggableAgentCard: React.FC<{
  agent: AIAgent
  isDragging?: boolean
}> = ({ agent, isDragging }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({ id: agent.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  const getExperienceColor = (level: string) => {
    switch (level) {
      case 'junior': return 'bg-blue-100 text-blue-800'
      case 'mid': return 'bg-green-100 text-green-800'
      case 'senior': return 'bg-orange-100 text-orange-800'
      case 'expert': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md',
        isDragging && 'opacity-50 rotate-3 scale-105'
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-blue-600" />
            <h4 className="font-medium text-sm">{agent.name}</h4>
          </div>
          <Badge variant="secondary" className="text-xs">
            {agent.type}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <Badge className={cn('text-xs', getExperienceColor(agent.experience_level))}>
            {agent.experience_level}
          </Badge>
          
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>${agent.cost_per_hour}/hr</span>
            <div className="flex items-center space-x-1">
              <Award className="w-3 h-3" />
              <span>{agent.performance_score}%</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.slice(0, 3).map((capability) => (
              <Badge key={capability} variant="outline" className="text-xs">
                {capability}
              </Badge>
            ))}
            {agent.capabilities.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{agent.capabilities.length - 3}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Team Canvas Drop Zone
const TeamCanvas: React.FC<{
  members: TeamMember[]
  onMemberUpdate: (member: TeamMember) => void
  onMemberRemove: (memberId: string) => void
}> = ({ members, onMemberUpdate, onMemberRemove }) => {
  return (
    <div className="relative w-full h-96 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 p-4">
      <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none">
        <div className="text-center">
          <Users className="w-12 h-12 mx-auto mb-2" />
          <p>Drag AI agents here to build your team</p>
        </div>
      </div>
      
      {members.map((member) => (
        <div
          key={member.id}
          className="absolute"
          style={{
            left: `${member.position.x}%`,
            top: `${member.position.y}%`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Card className="w-48 shadow-lg border-2 border-blue-200">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-sm">{member.agent.name}</h4>
                  <p className="text-xs text-gray-600">{member.role}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onMemberRemove(member.id)}
                  className="h-6 w-6 p-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Allocation: {member.allocation}%</Label>
                  <Progress value={member.allocation} className="h-1" />
                </div>
                
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1">
                    <DollarSign className="w-3 h-3" />
                    <span>${member.agent.cost_per_hour}/hr</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Target className="w-3 h-3" />
                    <span>{member.agent.performance_score}%</span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}

// Skill Gap Analysis Panel
const SkillGapAnalysisPanel: React.FC<{
  skillGaps: SkillGap[]
  roleTemplates: RoleTemplate[]
}> = ({ skillGaps, roleTemplates }) => {
  const getGapSeverity = (coverage: number) => {
    if (coverage >= 80) return { color: 'text-green-600', bg: 'bg-green-100' }
    if (coverage >= 60) return { color: 'text-yellow-600', bg: 'bg-yellow-100' }
    return { color: 'text-red-600', bg: 'bg-red-100' }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5" />
          <span>Skill Gap Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-64">
          <div className="space-y-3">
            {skillGaps.map((gap) => {
              const severity = getGapSeverity(gap.coverage)
              return (
                <div key={gap.skill} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{gap.skill}</span>
                    <Badge className={cn('text-xs', severity.color, severity.bg)}>
                      {gap.coverage}% covered
                    </Badge>
                  </div>
                  <Progress value={gap.coverage} className="h-2" />
                  {gap.required && gap.coverage < 50 && (
                    <Alert>
                      <AlertTriangle className="w-4 h-4" />
                      <AlertDescription className="text-xs">
                        Critical skill gap - consider adding agents with {gap.skill} expertise
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// Cost Optimization Sidebar
const CostOptimizationSidebar: React.FC<{
  costAnalysis: CostAnalysis
}> = ({ costAnalysis }) => {
  const chartData = Object.entries(costAnalysis.cost_by_role).map(([role, cost]) => ({
    role,
    cost
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Cost Analysis</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Hourly</p>
              <p className="text-lg font-bold">${costAnalysis.total_hourly_cost}</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Monthly</p>
              <p className="text-lg font-bold">${costAnalysis.total_monthly_cost}</p>
            </div>
          </div>

          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={40}
                  fill="#8884d8"
                  dataKey="cost"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`hsl(${index * 60}, 70%, 50%)`}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${value}`, 'Cost']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2">Optimization Suggestions</h4>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {costAnalysis.optimization_suggestions.map((suggestion, index) => (
                  <Alert key={index} className="py-2">
                    <div className="flex items-start space-x-2">
                      {suggestion.priority === 'high' && (
                        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs">{suggestion.description}</p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {suggestion.impact}% impact
                        </Badge>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Performance Prediction Chart
const PerformancePredictionChart: React.FC<{
  prediction: PerformancePrediction
}> = ({ prediction }) => {
  const performanceData = [
    { metric: 'Overall', score: prediction.overall_score },
    { metric: 'Timeline', score: prediction.timeline_efficiency },
    { metric: 'Quality', score: prediction.quality_score },
    { metric: 'Collaboration', score: prediction.collaboration_score }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5" />
          <span>Performance Prediction</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">
              {prediction.success_probability}%
            </p>
            <p className="text-sm text-gray-600">Success Probability</p>
          </div>

          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="metric" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="score" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {prediction.risk_factors.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span>Risk Factors</span>
              </h4>
              <div className="space-y-1">
                {prediction.risk_factors.map((risk, index) => (
                  <Alert key={index} className="py-2">
                    <AlertDescription className="text-xs">{risk}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Save Team Dialog
const SaveTeamDialog: React.FC<{
  team: TeamComposition
  onSave: (team: TeamComposition) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ team, onSave, open, onOpenChange }) => {
  const [formData, setFormData] = useState({
    name: team.name || '',
    description: team.description || ''
  })

  const handleSave = () => {
    onSave({
      ...team,
      name: formData.name,
      description: formData.description
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Team Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter team name"
            />
          </div>
          <div>
            <Label htmlFor="team-description">Description</Label>
            <Textarea
              id="team-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe the team's purpose and goals"
              rows={3}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formData.name.trim()}>
              <Save className="w-4 h-4 mr-2" />
              Save Team
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main Component
export const VisualTeamBuilder: React.FC<VisualTeamBuilderProps> = ({
  className,
  onTeamSave,
  onTeamLoad,
  initialTeam,
  availableAgents = [],
  roleTemplates = []
}) => {
  // State
  const [team, setTeam] = useState<TeamComposition>(
    initialTeam || {
      name: '',
      description: '',
      members: []
    }
  )
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    })
  )

  // Mock data generators
  const generateSkillGaps = useCallback((): SkillGap[] => {
    const allSkills = new Set<string>()
    roleTemplates.forEach(template => {
      template.required_skills.forEach(skill => allSkills.add(skill))
      template.optional_skills.forEach(skill => allSkills.add(skill))
    })

    return Array.from(allSkills).map(skill => {
      const coverage = Math.random() * 100
      const isRequired = roleTemplates.some(t => t.required_skills.includes(skill))
      const agentsWithSkill = team.members.filter(m => 
        m.agent.capabilities.includes(skill)
      ).map(m => m.agent.name)

      return {
        skill,
        required: isRequired,
        coverage,
        agents: agentsWithSkill
      }
    })
  }, [team.members, roleTemplates])

  const generateCostAnalysis = useCallback((): CostAnalysis => {
    const totalHourlyCost = team.members.reduce((sum, member) => 
      sum + (member.agent.cost_per_hour * member.allocation / 100), 0
    )

    const costByRole = team.members.reduce((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + member.agent.cost_per_hour
      return acc
    }, {} as Record<string, number>)

    const optimizationSuggestions: OptimizationSuggestion[] = [
      {
        type: 'cost_reduction',
        description: 'Consider reducing allocation for over-allocated junior agents',
        impact: 15,
        priority: 'medium'
      },
      {
        type: 'performance_improvement',
        description: 'Add senior agent for complex tasks to improve efficiency',
        impact: 25,
        priority: 'high'
      }
    ]

    return {
      total_hourly_cost: totalHourlyCost,
      total_daily_cost: totalHourlyCost * 8,
      total_monthly_cost: totalHourlyCost * 8 * 22,
      cost_by_role: costByRole,
      optimization_suggestions: optimizationSuggestions
    }
  }, [team.members])

  const generatePerformancePrediction = useCallback((): PerformancePrediction => {
    const avgPerformance = team.members.reduce((sum, member) =>