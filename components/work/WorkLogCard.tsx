'use client';

import { JavariWorkLog } from '@/lib/types/javari-types';
import { 
  FileIcon, 
  CodeIcon, 
  TestTubeIcon, 
  BugIcon, 
  SparklesIcon,
  GitCommitIcon,
  RocketIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from 'lucide-react';

interface WorkLogCardProps {
  workLog: JavariWorkLog;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

const actionTypeIcons: Record<string, React.ReactNode> = {
  file_created: <FileIcon className="w-4 h-4" />,
  file_modified: <CodeIcon className="w-4 h-4" />,
  file_deleted: <FileIcon className="w-4 h-4" />,
  api_created: <SparklesIcon className="w-4 h-4" />,
  test_written: <TestTubeIcon className="w-4 h-4" />,
  bug_fixed: <BugIcon className="w-4 h-4" />,
  feature_added: <SparklesIcon className="w-4 h-4" />,
  refactored: <CodeIcon className="w-4 h-4" />,
  deployed: <RocketIcon className="w-4 h-4" />,
};

const impactColors: Record<string, string> = {
  minor: 'bg-blue-100 text-blue-800 border-blue-200',
  moderate: 'bg-green-100 text-green-800 border-green-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

const categoryColors: Record<string, string> = {
  code: 'bg-purple-50 text-purple-700',
  config: 'bg-blue-50 text-blue-700',
  docs: 'bg-green-50 text-green-700',
  tests: 'bg-yellow-50 text-yellow-700',
  deployment: 'bg-red-50 text-red-700',
};

export function WorkLogCard({ workLog, onEdit, onDelete, showActions = true }: WorkLogCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className={`
      bg-white rounded-lg border-2 shadow-sm p-4 hover:shadow-md transition-shadow
      ${impactColors[workLog.impact_level]}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${categoryColors[workLog.action_category]}`}>
            {actionTypeIcons[workLog.action_type] || <FileIcon className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 capitalize">
              {workLog.action_type.replace(/_/g, ' ')}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColors[workLog.action_category]}`}>
                {workLog.action_category}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${impactColors[workLog.impact_level]}`}>
                {workLog.impact_level} impact
              </span>
            </div>
          </div>
        </div>
        
        {showActions && (onEdit || onDelete) && (
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(workLog.id)}
                className="text-sm text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(workLog.id)}
                className="text-sm text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-700 mb-3 leading-relaxed">
        {workLog.description}
      </p>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {workLog.lines_added > 0 && (
          <div className="bg-green-50 rounded-lg p-2">
            <div className="text-xs text-green-600 font-medium">Lines Added</div>
            <div className="text-lg font-bold text-green-700">+{workLog.lines_added}</div>
          </div>
        )}
        
        {workLog.lines_deleted > 0 && (
          <div className="bg-red-50 rounded-lg p-2">
            <div className="text-xs text-red-600 font-medium">Lines Deleted</div>
            <div className="text-lg font-bold text-red-700">-{workLog.lines_deleted}</div>
          </div>
        )}
        
        {workLog.complexity_added > 0 && (
          <div className="bg-purple-50 rounded-lg p-2">
            <div className="text-xs text-purple-600 font-medium">Complexity</div>
            <div className="text-lg font-bold text-purple-700">+{workLog.complexity_added}</div>
          </div>
        )}
        
        {(workLog.cost_saved > 0 || workLog.cost_incurred > 0) && (
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="text-xs text-blue-600 font-medium">Cost Impact</div>
            <div className="text-lg font-bold text-blue-700">
              ${((workLog.cost_saved || 0) - (workLog.cost_incurred || 0)).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Files Affected */}
      {workLog.files_affected && workLog.files_affected.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">Files Affected:</div>
          <div className="flex flex-wrap gap-1">
            {workLog.files_affected.slice(0, 3).map((file, idx) => (
              <span 
                key={idx}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono"
              >
                {file.split('/').pop()}
              </span>
            ))}
            {workLog.files_affected.length > 3 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                +{workLog.files_affected.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {workLog.tests_added && (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            <CheckCircleIcon className="w-3 h-3" />
            Tests Added
          </span>
        )}
        
        {workLog.breaking_change && (
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
            <AlertTriangleIcon className="w-3 h-3" />
            Breaking Change
          </span>
        )}
        
        {workLog.needs_review && !workLog.review_completed && (
          <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
            <ClockIcon className="w-3 h-3" />
            Needs Review
          </span>
        )}
        
        {workLog.review_completed && (
          <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            <CheckCircleIcon className="w-3 h-3" />
            Reviewed
          </span>
        )}
      </div>

      {/* Footer Links */}
      <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <ClockIcon className="w-3 h-3" />
          {formatDate(workLog.created_at)}
        </div>
        
        {workLog.commit_sha && (
          <a
            href={`https://github.com/CR-AudioViz-AI/javari-ai/commit/${workLog.commit_sha}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <GitCommitIcon className="w-3 h-3" />
            {workLog.commit_sha.substring(0, 7)}
          </a>
        )}
        
        {workLog.deploy_url && (
          <a
            href={workLog.deploy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline"
          >
            <RocketIcon className="w-3 h-3" />
            View Deployment
          </a>
        )}
      </div>
    </div>
  );
}
