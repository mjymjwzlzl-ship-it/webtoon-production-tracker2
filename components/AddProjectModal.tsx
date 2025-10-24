import React, { useState } from 'react';
import type { ProjectType, Team, AdultSubType } from '../types';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProject: (type: ProjectType, team: Team, adultSubType?: AdultSubType) => void;
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  onAddProject
}) => {
  const [type, setType] = useState<ProjectType>('adult');
  const [team, setTeam] = useState<Team>('0팀');
  const [adultSubType, setAdultSubType] = useState<AdultSubType>('internal-ai');

  if (!isOpen) return null;

  const handleAddProject = (selectedType: ProjectType) => {
    if (selectedType === 'adult') {
      onAddProject(selectedType, team, adultSubType);
    } else {
      onAddProject(selectedType, team);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center">
          <h3 className="text-xl leading-6 font-bold text-slate-900" id="modal-title">
            새 작품 추가
          </h3>
          <div className="mt-3">
            <p className="text-sm text-slate-600">
              추가할 작품의 소속 팀과 유형을 선택하세요. <br/>
              작품 유형에 따라 관리할 작업 프로세스가 달라집니다.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="team-select" className="block text-sm font-medium text-slate-700 mb-1.5 text-left">팀 선택</label>
            <select
              id="team-select"
              value={team}
              onChange={(e) => setTeam(e.target.value as Team)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-700 focus:ring-2 focus:ring-primary-blue focus:border-primary-blue"
            >
              <option value="0팀">0팀</option>
              <option value="1팀">1팀</option>
            </select>
          </div>

          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1.5 text-left">작품 유형 선택</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue sm:text-sm transition-opacity ${
                  type === 'adult' 
                    ? 'bg-primary-blue text-white hover:opacity-90' 
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => setType('adult')}
              >
                19금 작품 (7단계)
              </button>
              <button
                type="button"
                className={`w-full inline-flex justify-center rounded-md border shadow-sm px-4 py-3 text-base font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue sm:text-sm transition-colors ${
                  type === 'general' 
                    ? 'bg-primary-blue text-white hover:opacity-90 border-transparent' 
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => setType('general')}
              >
                일반 작품 (5단계)
              </button>
            </div>
          </div>

          {type === 'adult' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 text-left">19금 작품 하위 유형</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`w-full inline-flex justify-center rounded-md border shadow-sm px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue transition-colors ${
                    adultSubType === 'internal-ai' 
                      ? 'bg-primary-blue text-white border-transparent' 
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => setAdultSubType('internal-ai')}
                >
                  사내AI
                </button>
                <button
                  type="button"
                  className={`w-full inline-flex justify-center rounded-md border shadow-sm px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-blue transition-colors ${
                    adultSubType === 'cope-inter' 
                      ? 'bg-primary-blue text-white border-transparent' 
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                  onClick={() => setAdultSubType('cope-inter')}
                >
                  코페인터
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              className="flex-1 bg-primary-blue hover:opacity-90 text-white font-bold py-2 px-4 rounded-md transition-opacity duration-200"
              onClick={() => handleAddProject(type)}
            >
              작품 추가
            </button>
            <button
              type="button"
              className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 px-4 rounded-md transition-colors duration-200"
              onClick={onClose}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddProjectModal;
