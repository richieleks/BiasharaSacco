import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward,
  CheckCircle, 
  Clock, 
  XCircle, 
  AlertCircle,
  User,
  Users, 
  Building2,
  CreditCard,
  DollarSign,
  FileText,
  ArrowRight,
  ArrowDown
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  role: string;
  estimatedTime: string;
  requirements?: string[];
}

interface LoanWorkflow {
  id: string;
  title: string;
  description: string;
  amountRange: string;
  steps: WorkflowStep[];
  color: string;
}

const workflowDefinitions: LoanWorkflow[] = [
  {
    id: 'standard',
    title: 'Loan Approval Process',
    description: 'Standard 3-step loan approval workflow for all loan applications',
    amountRange: 'All Amounts',
    color: 'bg-blue-500',
    steps: [
      {
        id: 'application',
        title: 'Application Submission',
        description: 'Member submits loan application with required documentation',
        icon: FileText,
        role: 'Member',
        estimatedTime: '15 minutes',
        requirements: ['Complete application form', 'Income verification', 'Guarantor details', 'ID verification']
      },
      {
        id: 'committee-review',
        title: 'Committee Evaluation & Approval',
        description: 'Detailed evaluation of loan request, risk assessment, and approval of loan terms and conditions',
        icon: Users,
        role: 'Committee',
        estimatedTime: '24-48 hours',
        requirements: ['Credit scoring', 'Risk analysis', 'Guarantor verification', 'Terms approval', 'Committee consensus']
      },
      {
        id: 'disbursement',
        title: 'Treasurer Disbursement',
        description: 'Treasurer disburses approved funds to member account',
        icon: DollarSign,
        role: 'Treasurer',
        estimatedTime: '1-2 hours',
        requirements: ['Account verification', 'Transfer authorization', 'Fund availability check']
      }
    ]
  }
];

interface LoanWorkflowVisualizationProps {
  selectedLoanAmount?: number;
  selectedWorkflowId?: string;
  autoPlay?: boolean;
}

export default function LoanWorkflowVisualization({ 
  selectedLoanAmount, 
  selectedWorkflowId,
  autoPlay = false 
}: LoanWorkflowVisualizationProps) {
  const [currentWorkflow, setCurrentWorkflow] = useState<LoanWorkflow>(workflowDefinitions[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [animationSpeed, setAnimationSpeed] = useState(2000);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  useEffect(() => {
    setCurrentWorkflow(workflowDefinitions[0]);
    setCurrentStep(0);
    setCompletedSteps(new Set());
  }, [selectedLoanAmount, selectedWorkflowId]);

  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      setCurrentStep(prev => {
        const nextStep = prev + 1;
        if (nextStep >= currentWorkflow.steps.length) {
          setIsPlaying(false);
          setCompletedSteps(new Set(Array.from({ length: currentWorkflow.steps.length }, (_, i) => i)));
          return prev;
        }
        setCompletedSteps(prevCompleted => {
          const completedArray = Array.from(prevCompleted);
          return new Set([...completedArray, prev]);
        });
        return nextStep;
      });
    }, animationSpeed);

    return () => clearInterval(timer);
  }, [isPlaying, animationSpeed, currentWorkflow.steps.length]);

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleReset = () => {
    setCurrentStep(0);
    setCompletedSteps(new Set());
    setIsPlaying(false);
  };

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
    setCompletedSteps(new Set(Array.from({ length: stepIndex }, (_, i) => i)));
    setIsPlaying(false);
  };

  const progress = ((currentStep + 1) / currentWorkflow.steps.length) * 100;

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'member': return User;
      case 'treasurer': return User;
      case 'committee': return Users;
      case 'manager': return Building2;
      case 'system': return CreditCard;
      default: return AlertCircle;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'member': return 'bg-slate-500';
      case 'treasurer': return 'bg-green-500';
      case 'committee': return 'bg-blue-500';
      case 'admin': return 'bg-red-500';
      case 'system': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Loan Workflow Visualization
          </CardTitle>
          <CardDescription>
            Interactive visualization of the loan approval process
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {workflowDefinitions.map(workflow => (
              <Button
                key={workflow.id}
                variant={currentWorkflow.id === workflow.id ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentWorkflow(workflow);
                  setCurrentStep(0);
                  setCompletedSteps(new Set());
                  setIsPlaying(false);
                }}
                className="flex items-center gap-2"
              >
                <div className={cn("w-2 h-2 rounded-full", workflow.color)} />
                {workflow.title}
                <Badge variant="secondary" className="text-xs">
                  {workflow.amountRange}
                </Badge>
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Button
              onClick={isPlaying ? handlePause : handlePlay}
              size="sm"
              className="flex items-center gap-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button onClick={handleReset} size="sm" variant="outline">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 ml-4">
              <span className="text-sm text-muted-foreground">Speed:</span>
              <Button
                onClick={() => setAnimationSpeed(Math.max(500, animationSpeed - 500))}
                size="sm"
                variant="outline"
              >
                <FastForward className="h-4 w-4" />
              </Button>
              <span className="text-sm">{animationSpeed / 1000}s</span>
              <Button
                onClick={() => setAnimationSpeed(animationSpeed + 500)}
                size="sm"
                variant="outline"
              >
                <FastForward className="h-4 w-4 transform rotate-180" />
              </Button>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">{currentWorkflow.title}</span>
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {currentWorkflow.steps.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{currentWorkflow.title} Process</CardTitle>
          <CardDescription>{currentWorkflow.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {currentWorkflow.steps.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = completedSteps.has(index);
              const isPending = index > currentStep;
              const StepIcon = step.icon;
              const RoleIcon = getRoleIcon(step.role);
              
              return (
                <div key={step.id} className="relative">
                  <div
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border-2 transition-all duration-500 cursor-pointer",
                      isActive && "border-primary bg-primary/5 shadow-md",
                      isCompleted && "border-green-500 bg-green-50 dark:bg-green-950/50",
                      isPending && "border-gray-200 dark:border-gray-700 bg-gray-50"
                    )}
                    onClick={() => handleStepClick(index)}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500",
                      isActive && "bg-primary text-primary-foreground scale-110",
                      isCompleted && "bg-green-500 text-white",
                      isPending && "bg-gray-200 text-gray-500 dark:text-gray-400 dark:text-gray-500"
                    )}>
                      {isCompleted ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : isActive ? (
                        <Clock className="h-6 w-6 animate-pulse" />
                      ) : (
                        <StepIcon className="h-6 w-6" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className={cn(
                          "font-semibold transition-colors",
                          isActive && "text-primary",
                          isCompleted && "text-green-700"
                        )}>
                          {step.title}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "flex items-center gap-1",
                            getRoleColor(step.role),
                            "text-white"
                          )}
                        >
                          <RoleIcon className="h-3 w-3" />
                          {step.role}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {step.estimatedTime}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-3">
                        {step.description}
                      </p>

                      {step.requirements && (
                        <div className="space-y-2">
                          <span className="text-xs font-medium text-muted-foreground">Requirements:</span>
                          <div className="flex flex-wrap gap-1">
                            {step.requirements.map((req, reqIndex) => (
                              <Badge key={reqIndex} variant="outline" className="text-xs">
                                {req}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      {isActive && (
                        <div className="animate-bounce">
                          <ArrowDown className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <span className={cn(
                        "text-xs font-medium",
                        isCompleted && "text-green-600",
                        isActive && "text-primary",
                        isPending && "text-gray-400 dark:text-gray-500"
                      )}>
                        {isCompleted ? "Complete" : isActive ? "In Progress" : "Pending"}
                      </span>
                    </div>
                  </div>

                  {index < currentWorkflow.steps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className={cn(
                        "h-4 w-4 transition-colors",
                        index < currentStep ? "text-green-500" : "text-gray-300"
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {currentWorkflow.steps[currentStep] && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Current Step Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  {currentWorkflow.steps[currentStep].title}
                </h3>
                <p className="text-muted-foreground">
                  {currentWorkflow.steps[currentStep].description}
                </p>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium">Responsible Role</span>
                  <p className="text-lg">{currentWorkflow.steps[currentStep].role}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Estimated Time</span>
                  <p className="text-lg">{currentWorkflow.steps[currentStep].estimatedTime}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Requirements</span>
                  <p className="text-lg">{currentWorkflow.steps[currentStep].requirements?.length || 0} items</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}