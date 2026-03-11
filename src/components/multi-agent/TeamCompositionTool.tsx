'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  Users, 
  Brain, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Settings,
  Zap,
  Star,
  Clock,
  DollarSign,
  BarChart3
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  type: string
  skills: Skill[]
  availability: number
  cost: number
  performance_score: number
  specializations: string[]
  experience_level: 'junior' | 'mid' | 'senior' | 'expert'
}

interface Skill {
  id: string
  name: string
  category: string
  proficiency: number
  verified: boolean
}

interface TaskRequirement {
  id: string
  skill_category: string
  skill_name: string
  required_proficiency: number
  importance: 'low' | 'medium' | 'high' | 'critical'
  estimated_effort: number
}

interface TeamSuggestion {
  id: string
  agents: Agent[]
  total_cost: number
  estimated_duration: number
  success_probability: number
  skill_coverage: number
  risk_factors: string[]
  strengths: string[]
  composition_score: number
}

interface SkillGap {
  skill_name: string
  category: string
  required_proficiency: number
  current_proficiency: number
  gap_severity: 'minor' | 'moderate' | 'major' | 'critical'
  suggestions: string[]
}

interface TeamCompositionToolProps {
  projectId?: string
  onTeamSelected?: (team: TeamSuggestion) => void
  onSaveComposition?: (composition: TeamSuggestion) => void
  className?: string
}

export default function TeamCompositionTool({
  projectId,
  onTeamSelected,
  onSaveComposition,
  className = ''
}: TeamCompositionToolProps) {
  // State management
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskComplexity, setTaskComplexity] = useState<'low' | 'medium' | 'high' | 'expert'>('medium')
  const [taskDeadline, setTaskDeadline] = useState('')
  const [budget, setBudget] = useState([1000])
  const [teamSize, setTeamSize] = useState([3])
  const [requirements, setRequirements] = useState<TaskRequirement[]>([])
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
  const [teamSuggestions, setTeamSuggestions] = useState<TeamSuggestion[]>([])
  const [skillGaps, setSkillGaps] = useState<SkillGap[]>([])
  const [selectedSuggestion, setSelectedSuggestion] = useState<TeamSuggestion | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [prioritizePerformance, setPrioritizePerformance] = useState(true)
  const [prioritizeCost, setPrioritizeCost] = useState(false)
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(false)
  const [activeTab, setActiveTab] = useState('requirements')

  // Fetch available agents
  useEffect(() => {
    fetchAvailableAgents()
  }, [])

  const fetchAvailableAgents = async () => {
    try {
      const response = await fetch('/api/agents/capabilities')
      const data = await response.json()
      setAvailableAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const analyzeTaskRequirements = async () => {
    if (!taskTitle.trim() || !taskDescription.trim()) return

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/tasks/analyze-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          complexity: taskComplexity,
          deadline: taskDeadline
        })
      })

      const data = await response.json()
      setRequirements(data.requirements || [])
      
      // Auto-advance to team suggestions
      if (data.requirements?.length > 0) {
        generateTeamSuggestions(data.requirements)
      }
    } catch (error) {
      console.error('Error analyzing requirements:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generateTeamSuggestions = async (taskRequirements = requirements) => {
    if (taskRequirements.length === 0) return

    setIsAnalyzing(true)
    try {
      const response = await fetch('/api/team-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirements: taskRequirements,
          constraints: {
            max_budget: budget[0],
            max_team_size: teamSize[0],
            deadline: taskDeadline,
            priorities: {
              performance: prioritizePerformance,
              cost: prioritizeCost,
              speed: prioritizeSpeed
            }
          },
          available_agents: availableAgents.map(a => a.id)
        })
      })

      const data = await response.json()
      setTeamSuggestions(data.suggestions || [])
      setSkillGaps(data.skill_gaps || [])
      
      if (data.suggestions?.length > 0) {
        setActiveTab('suggestions')
      }
    } catch (error) {
      console.error('Error generating suggestions:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const addCustomRequirement = () => {
    const newRequirement: TaskRequirement = {
      id: `req_${Date.now()}`,
      skill_category: '',
      skill_name: '',
      required_proficiency: 70,
      importance: 'medium',
      estimated_effort: 10
    }
    setRequirements([...requirements, newRequirement])
  }

  const updateRequirement = (index: number, field: keyof TaskRequirement, value: any) => {
    const updated = [...requirements]
    updated[index] = { ...updated[index], [field]: value }
    setRequirements(updated)
  }

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index))
  }

  const getSkillCoverageColor = (coverage: number) => {
    if (coverage >= 90) return 'text-green-600'
    if (coverage >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getGapSeverityColor = (severity: SkillGap['gap_severity']) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-800'
      case 'moderate': return 'bg-orange-100 text-orange-800'
      case 'major': return 'bg-red-100 text-red-800'
      case 'critical': return 'bg-red-200 text-red-900'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const skillCategories = useMemo(() => {
    const categories = new Set<string>()
    availableAgents.forEach(agent => 
      agent.skills.forEach(skill => categories.add(skill.category))
    )
    return Array.from(categories)
  }, [availableAgents])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Composition Tool</h2>
          <p className="text-gray-600">AI-powered team optimization for optimal task execution</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        {/* Task Requirements Tab */}
        <TabsContent value="requirements" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Task Information
              </CardTitle>
              <CardDescription>
                Describe your task to generate intelligent team suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task Title</Label>
                  <Input
                    id="task-title"
                    placeholder="Enter task title..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-complexity">Complexity Level</Label>
                  <Select value={taskComplexity} onValueChange={(value: any) => setTaskComplexity(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Simple tasks</SelectItem>
                      <SelectItem value="medium">Medium - Standard complexity</SelectItem>
                      <SelectItem value="high">High - Complex requirements</SelectItem>
                      <SelectItem value="expert">Expert - Specialized skills needed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Task Description</Label>
                <Textarea
                  id="task-description"
                  placeholder="Provide detailed description of the task, goals, and specific requirements..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Budget Range: ${budget[0]}</Label>
                  <Slider
                    value={budget}
                    onValueChange={setBudget}
                    min={100}
                    max={10000}
                    step={100}
                    className="w-full"
                  />
                </div>
              </div>

              <Button 
                onClick={analyzeTaskRequirements} 
                disabled={isAnalyzing || !taskTitle.trim()}
                className="w-full"
              >
                {isAnalyzing ? (
                  <>
                    <Brain className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing Requirements...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze & Generate Teams
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Manual Requirements */}
          {requirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detected Requirements</CardTitle>
                <CardDescription>AI-identified skill requirements - customize as needed</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-4">
                    {requirements.map((req, index) => (
                      <div key={req.id} className="p-4 border rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Skill Category</Label>
                            <Select 
                              value={req.skill_category} 
                              onValueChange={(value) => updateRequirement(index, 'skill_category', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                {skillCategories.map(category => (
                                  <SelectItem key={category} value={category}>{category}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Skill Name</Label>
                            <Input
                              value={req.skill_name}
                              onChange={(e) => updateRequirement(index, 'skill_name', e.target.value)}
                              placeholder="Specific skill"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Required Level: {req.required_proficiency}%</Label>
                            <Slider
                              value={[req.required_proficiency]}
                              onValueChange={(value) => updateRequirement(index, 'required_proficiency', value[0])}
                              min={0}
                              max={100}
                              step={5}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Importance</Label>
                            <Select 
                              value={req.importance} 
                              onValueChange={(value: any) => updateRequirement(index, 'importance', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Est. Effort (hours)</Label>
                            <Input
                              type="number"
                              value={req.estimated_effort}
                              onChange={(e) => updateRequirement(index, 'estimated_effort', parseInt(e.target.value))}
                              min="1"
                            />
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeRequirement(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove Requirement
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                
                <div className="flex justify-between mt-4">
                  <Button variant="outline" onClick={addCustomRequirement}>
                    Add Custom Requirement
                  </Button>
                  <Button onClick={() => generateTeamSuggestions()}>
                    Update Team Suggestions
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Team Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-6">
          {teamSuggestions.length > 0 ? (
            <div className="grid gap-6">
              {teamSuggestions.map((suggestion, index) => (
                <Card 
                  key={suggestion.id} 
                  className={`cursor-pointer transition-all ${
                    selectedSuggestion?.id === suggestion.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => setSelectedSuggestion(suggestion)}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Team Option {index + 1}
                          {index === 0 && <Badge variant="default">Recommended</Badge>}
                        </CardTitle>
                        <CardDescription>
                          {suggestion.agents.length} agents • ${suggestion.total_cost} budget • {suggestion.estimated_duration}h duration
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 mb-1">
                          <Star className="h-4 w-4 text-yellow-500" />
                          <span className="font-medium">{suggestion.composition_score}/100</span>
                        </div>
                        <Badge variant={suggestion.success_probability > 80 ? 'default' : 'secondary'}>
                          {suggestion.success_probability}% Success Rate
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Team Members */}
                      <div>
                        <h4 className="font-medium mb-2">Team Members</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {suggestion.agents.map(agent => (
                            <div key={agent.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                              <div className="flex-1">
                                <div className="font-medium text-sm">{agent.name}</div>
                                <div className="text-xs text-gray-600">{agent.type} • {agent.experience_level}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-medium">{agent.performance_score}/100</div>
                                <div className="text-xs text-gray-600">${agent.cost}/h</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-4 gap-4">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <BarChart3 className="h-4 w-4 text-blue-600" />
                            <span className="text-sm font-medium">Coverage</span>
                          </div>
                          <div className={`font-bold ${getSkillCoverageColor(suggestion.skill_coverage)}`}>
                            {suggestion.skill_coverage}%
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium">Cost</span>
                          </div>
                          <div className="font-bold text-green-600">${suggestion.total_cost}</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Clock className="h-4 w-4 text-orange-600" />
                            <span className="text-sm font-medium">Duration</span>
                          </div>
                          <div className="font-bold text-orange-600">{suggestion.estimated_duration}h</div>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <TrendingUp className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium">Success</span>
                          </div>
                          <div className="font-bold text-purple-600">{suggestion.success_probability}%</div>
                        </div>
                      </div>

                      {/* Strengths and Risks */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-green-700 mb-1">Strengths</h5>
                          <ul className="text-sm space-y-1">
                            {suggestion.strengths.map((strength, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                                {strength}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-orange-700 mb-1">Risk Factors</h5>
                          <ul className="text-sm space-y-1">
                            {suggestion.risk_factors.map((risk, i) => (
                              <li key={i} className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-orange-600" />
                                {