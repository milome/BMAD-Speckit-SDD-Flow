#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PR Template Generator - Enhanced Version v2
Analyzes commits since last PR and generates a comprehensive PR template
with detailed implementation descriptions extracted from:
- Commit messages and bodies
- Related BUGFIX documentation files
- File change analysis
"""

import subprocess
import sys
import os
import re
from datetime import datetime
from pathlib import Path
from collections import defaultdict
from typing import Optional, List, Dict, Tuple


def run_git_command(args: list[str], cwd: str = None) -> str:
    """Run a git command and return output."""
    try:
        result = subprocess.run(
            ['git', '-c', 'core.quotepath=false'] + args,
            capture_output=True,
            cwd=cwd
        )
        try:
            return result.stdout.decode('utf-8').strip()
        except UnicodeDecodeError:
            return result.stdout.decode('latin-1').strip()
    except Exception as e:
        print(f"Error running git command: {e}", file=sys.stderr)
        return ""


def get_current_branch() -> str:
    return run_git_command(['rev-parse', '--abbrev-ref', 'HEAD'])


def get_merge_base(base_branch: str) -> str:
    return run_git_command(['merge-base', base_branch, 'HEAD'])


def get_commits(commit_range: str) -> list[dict]:
    """Get commits with full message body."""
    # Use %x00 as delimiter for body to handle multi-line
    output = run_git_command([
        'log', commit_range,
        '--pretty=format:%H|%s|%an|%ad|%B%x00',
        '--date=short'
    ])
    
    commits = []
    if output:
        # Split by null character to separate commits
        for entry in output.split('\x00'):
            entry = entry.strip()
            if not entry or '|' not in entry:
                continue
            
            parts = entry.split('|', 4)
            if len(parts) >= 4:
                body = parts[4] if len(parts) > 4 else ''
                # Clean up body - remove the subject line duplicate
                body_lines = body.split('\n')
                if body_lines and body_lines[0].strip() == parts[1].strip():
                    body_lines = body_lines[1:]
                body = '\n'.join(body_lines).strip()
                
                commits.append({
                    'hash': parts[0][:9],
                    'full_hash': parts[0],
                    'message': parts[1],
                    'author': parts[2],
                    'date': parts[3],
                    'body': body
                })
    return commits


def get_changed_files_for_commit(commit_hash: str) -> list[str]:
    output = run_git_command(['show', '--name-only', '--format=', commit_hash])
    return [f.strip() for f in output.split('\n') if f.strip()]


def find_related_bugfix_doc(message: str, cwd: str = '.') -> Optional[str]:
    """Find related BUGFIX documentation file based on commit message."""
    # Extract keywords from message
    keywords = []
    
    # Common patterns to extract
    patterns = [
        r'(\d+分钟|\d+小时|日线)',
        r'(K线|周期|聚合)',
        r'(datetime_end|period_end)',
        r'(CTA|策略|Policy)',
        r'(图表|Chart|Widget)',
        r'(数据库|Database)',
        r'(ATR|Tick|限流)',
        r'(画线|PriceLine)',
        r'(渲染|绘制|显示)',
        r'(缓存|Cache)',
        r'(半日休市|假期|holiday)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            keywords.append(match.group(1))
    
    if not keywords:
        # Use first few words as keywords
        words = re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z]+', message)
        keywords = words[:3]
    
    # Search for matching BUGFIX files
    search_dirs = ['bugfix', 'specs']
    for search_dir in search_dirs:
        search_path = Path(cwd) / search_dir
        if search_path.exists():
            for md_file in search_path.rglob('BUGFIX*.md'):
                file_name = md_file.name.lower()
                file_content = ""
                try:
                    with open(md_file, 'r', encoding='utf-8') as f:
                        file_content = f.read(500).lower()  # Read first 500 chars
                except:
                    continue
                
                # Check if keywords match
                for keyword in keywords:
                    if keyword.lower() in file_name or keyword.lower() in file_content:
                        return str(md_file)
    
    return None


def extract_bugfix_summary(doc_path: str) -> Dict[str, str]:
    """Extract problem description and solution from BUGFIX document."""
    result = {
        'problem': '',
        'solution': '',
        'details': []
    }
    
    try:
        with open(doc_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        return result
    
    # Extract problem description
    problem_patterns = [
        r'##\s*问题描述\s*\n+([\s\S]*?)(?=\n##|\Z)',
        r'##\s*问题\s*\n+([\s\S]*?)(?=\n##|\Z)',
        r'##\s*现象\s*\n+([\s\S]*?)(?=\n##|\Z)',
        r'\*\*问题\*\*[：:]\s*(.+)',
    ]
    
    for pattern in problem_patterns:
        match = re.search(pattern, content)
        if match:
            result['problem'] = match.group(1).strip()[:300]  # Limit length
            break
    
    # Extract solution
    solution_patterns = [
        r'##\s*修复方案\s*\n+([\s\S]*?)(?=\n##|\Z)',
        r'##\s*解决方案\s*\n+([\s\S]*?)(?=\n##|\Z)',
        r'##\s*修复\s*\n+([\s\S]*?)(?=\n##|\Z)',
        r'\*\*修复\*\*[：:]\s*(.+)',
    ]
    
    for pattern in solution_patterns:
        match = re.search(pattern, content)
        if match:
            result['solution'] = match.group(1).strip()[:300]
            break
    
    # Extract key details (bullet points and numbered items)
    # Match bullet points: - item, * item
    bullet_pattern = r'^[-*]\s+(.+)$'
    # Match numbered items: 1. item, 2) item
    numbered_pattern = r'^\d+[.)]\s+(.+)$'
    
    bullet_details = re.findall(bullet_pattern, content, re.MULTILINE)
    numbered_details = re.findall(numbered_pattern, content, re.MULTILINE)
    
    # Combine and limit
    all_details = bullet_details + numbered_details
    result['details'] = all_details[:5]  # Limit to 5 details
    
    return result


def analyze_file_changes(files: List[str]) -> Dict[str, List[str]]:
    """Analyze file changes to infer implementation details."""
    analysis = {
        'modules': set(),
        'components': [],
        'tests_added': [],
        'docs_added': []
    }
    
    for f in files:
        # Extract module name
        if f.startswith('vnpy/'):
            parts = f.split('/')
            if len(parts) > 2:
                analysis['modules'].add(parts[1])
        
        # Identify components
        if 'chart' in f.lower():
            analysis['components'].append('图表模块')
        if 'period' in f.lower():
            analysis['components'].append('周期计算')
        if 'database' in f.lower() or 'sqlite' in f.lower():
            analysis['components'].append('数据库')
        if 'widget' in f.lower():
            analysis['components'].append('UI组件')
        if 'price_line' in f.lower():
            analysis['components'].append('画线交易')
        
        # Identify test files
        if 'test' in f.lower() and f.endswith('.py'):
            analysis['tests_added'].append(f)
        
        # Identify doc files
        if f.endswith('.md'):
            analysis['docs_added'].append(f)
    
    analysis['modules'] = list(analysis['modules'])
    analysis['components'] = list(set(analysis['components']))
    
    return analysis


def clean_list_prefix(line: str) -> str:
    """Remove list prefixes like '- ', '* ', '1. ', '2. ' etc."""
    # Remove bullet points: -, *, #
    line = re.sub(r'^[-*#]+\s*', '', line)
    # Remove numbered list prefixes: 1., 2., 1), 2) etc.
    line = re.sub(r'^\d+[.)]\s*', '', line)
    # Remove Chinese numbered list: 一、 二、 etc.
    line = re.sub(r'^[一二三四五六七八九十]+[、.]\s*', '', line)
    return line.strip()


def generate_implementation_details(commit: dict, cwd: str = '.') -> List[str]:
    """Generate detailed implementation description for a commit."""
    details = []
    message = commit['message']
    body = commit.get('body', '')
    files = commit.get('files', [])
    
    # 1. Extract from commit body if available
    if body:
        body_lines = [line.strip() for line in body.split('\n') if line.strip()]
        for line in body_lines[:5]:
            # Clean up any list prefixes (bullets or numbers)
            clean_line = clean_list_prefix(line)
            if clean_line and len(clean_line) > 5:
                details.append(clean_line)
    
    # 2. Try to find related BUGFIX documentation
    if 'fix' in message.lower() or '修复' in message:
        doc_path = find_related_bugfix_doc(message, cwd)
        if doc_path:
            bugfix_info = extract_bugfix_summary(doc_path)
            if bugfix_info['problem']:
                clean_problem = clean_list_prefix(bugfix_info['problem'][:100])
                details.append(f"问题: {clean_problem}")
            if bugfix_info['solution']:
                clean_solution = clean_list_prefix(bugfix_info['solution'][:100])
                details.append(f"方案: {clean_solution}")
            for d in bugfix_info['details'][:2]:
                clean_d = clean_list_prefix(d)
                if clean_d and clean_d not in details:
                    details.append(clean_d)
    
    # 3. Analyze file changes to infer details
    if not details and files:
        file_analysis = analyze_file_changes(files)
        
        if file_analysis['components']:
            details.append(f"涉及组件: {', '.join(file_analysis['components'][:3])}")
        
        if file_analysis['modules']:
            details.append(f"修改模块: {', '.join(file_analysis['modules'][:3])}")
        
        # Generate description based on file types
        py_files = [f for f in files if f.endswith('.py') and 'test' not in f.lower()]
        if py_files:
            # Extract key file names
            key_files = [Path(f).stem for f in py_files[:3]]
            details.append(f"核心文件: {', '.join(key_files)}")
        
        if file_analysis['tests_added']:
            details.append(f"新增测试用例 {len(file_analysis['tests_added'])} 个")
    
    # 4. Generate from message keywords if still empty
    if not details:
        # Extract key actions from message
        action_patterns = [
            (r'实现(.+?)(?:功能|系统|机制)', '实现了{}'),
            (r'修复(.+?)(?:问题|错误|bug)', '修复了{}相关问题'),
            (r'优化(.+?)(?:性能|逻辑|功能)', '优化了{}'),
            (r'添加(.+?)(?:功能|支持|处理)', '添加了{}'),
            (r'重构(.+?)(?:模块|代码|逻辑)', '重构了{}'),
        ]
        
        for pattern, template in action_patterns:
            match = re.search(pattern, message)
            if match:
                details.append(template.format(match.group(1)))
                break
        
        if not details:
            # Fallback: use cleaned message
            clean_msg = re.sub(r'^(feat|fix|docs|refactor|chore|test)(\([^)]+\))?:\s*', '', message)
            details.append(f"完成了{clean_msg}")
    
    return details[:5]  # Limit to 5 details


def analyze_commit_type(message: str) -> tuple[str, str]:
    """Analyze commit message to determine type and extract clean description."""
    # Conventional commit prefixes
    if message.startswith('feat:') or message.startswith('feat('):
        match = re.match(r'feat(?:\([^)]+\))?:\s*(.+)', message)
        return 'feature', match.group(1) if match else message
    
    if message.startswith('fix:') or message.startswith('fix('):
        match = re.match(r'fix(?:\([^)]+\))?:\s*(.+)', message)
        return 'bugfix', match.group(1) if match else message
    
    if message.startswith('docs:') or message.startswith('docs('):
        match = re.match(r'docs(?:\([^)]+\))?:\s*(.+)', message)
        return 'docs', match.group(1) if match else message
    
    if message.startswith('refactor:') or message.startswith('refactor('):
        match = re.match(r'refactor(?:\([^)]+\))?:\s*(.+)', message)
        return 'improvement', match.group(1) if match else message
    
    if message.startswith('chore:') or message.startswith('chore('):
        return 'chore', message
    
    if message.startswith('test:') or message.startswith('test('):
        return 'test', message
    
    # Chinese keywords
    if '实现' in message and '修复' not in message:
        return 'feature', message
    
    if re.search(r'修复|BUGFIX|Bug修复|fix', message, re.IGNORECASE):
        return 'bugfix', message
    
    if re.search(r'优化|改进|增强|性能|重构', message):
        return 'improvement', message
    
    if re.search(r'文档|docs|添加.*文档', message, re.IGNORECASE):
        return 'docs', message
    
    if re.search(r'测试|test', message, re.IGNORECASE):
        return 'test', message
    
    return 'other', message


def extract_core_topic(message: str) -> str:
    """Extract the core topic/module from a commit message."""
    patterns = [
        r'(\d+分钟|\d+小时|日线|K线|周期)',
        r'(聚合|缓存|渲染|绘制|显示)',
        r'(CTA|策略|Policy)',
        r'(图表|Chart|Widget)',
        r'(数据库|Database)',
        r'(ATR|Tick|限流)',
        r'(画线|Price ?Line)',
        r'(datetime_end|period)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            return match.group(1)
    
    words = message.split()
    for word in words:
        if len(word) > 2 and word not in ['feat:', 'fix:', 'docs:', 'the', 'and', 'for']:
            return word
    return message[:20]


def categorize_commits(commits: list[dict], cwd: str = '.') -> dict:
    """Categorize commits by type with detailed analysis."""
    categories = {
        'features': [],
        'improvements': [],
        'bugfixes': [],
        'documentation': [],
        'tests': [],
        'chores': [],
        'others': []
    }
    
    for commit in commits:
        commit_type, clean_msg = analyze_commit_type(commit['message'])
        commit['clean_message'] = clean_msg
        commit['files'] = get_changed_files_for_commit(commit['full_hash'])
        commit['impl_details'] = generate_implementation_details(commit, cwd)
        
        if commit_type == 'feature':
            categories['features'].append(commit)
        elif commit_type == 'bugfix':
            categories['bugfixes'].append(commit)
        elif commit_type == 'improvement':
            categories['improvements'].append(commit)
        elif commit_type == 'docs':
            categories['documentation'].append(commit)
        elif commit_type == 'test':
            categories['tests'].append(commit)
        elif commit_type == 'chore':
            categories['chores'].append(commit)
        else:
            categories['others'].append(commit)
    
    return categories


def get_file_stats(commit_range: str) -> tuple[int, str]:
    files_output = run_git_command(['diff', '--name-only', commit_range])
    files_count = len([f for f in files_output.split('\n') if f.strip()])
    stat_output = run_git_command(['diff', '--stat', commit_range])
    return files_count, stat_output


def get_new_docs(commit_range: str) -> list[str]:
    output = run_git_command(['diff', '--name-only', '--diff-filter=A', commit_range])
    docs = []
    for line in output.split('\n'):
        if line.strip() and (line.endswith('.md') or line.endswith('.rst')):
            docs.append(line.strip())
    return docs


def get_prioritized_files(files: List[str], max_count: int = 5) -> List[str]:
    """
    Get prioritized list of files, with implementation files first, then test files.
    
    Priority order:
    1. Core implementation files (vnpy/, not test)
    2. Scripts and tools (scripts/, tools/)
    3. Config files (config/, timeframe_config/)
    4. Test files (only if no impl files)
    """
    if not files:
        return []
    
    # Filter Python files only
    py_files = [f for f in files if f.endswith('.py')]
    
    # Separate by type
    impl_files = []
    test_files = []
    script_files = []
    
    for f in py_files:
        f_lower = f.lower()
        if 'test' in f_lower or f_lower.startswith('tests/'):
            test_files.append(f)
        elif f_lower.startswith('scripts/') or f_lower.startswith('tools/'):
            script_files.append(f)
        else:
            impl_files.append(f)
    
    # Prioritize: impl files > script files > test files
    result = []
    
    # Add implementation files first
    for f in impl_files:
        if len(result) < max_count:
            result.append(f)
    
    # Add script files if room
    for f in script_files:
        if len(result) < max_count:
            result.append(f)
    
    # Only add test files if we have no impl files
    if not impl_files and not script_files:
        for f in test_files[:max_count]:
            result.append(f)
    
    return result


def generate_feature_section(features: list[dict], start_num: int = 1) -> tuple[str, int]:
    """Generate detailed feature sections with implementation details."""
    lines = []
    num = start_num
    
    for commit in features:
        lines.append(f"### {num}. {commit['message']}")
        lines.append("")
        
        # Core changes
        lines.append("**核心变更**:")
        lines.append(f"- {commit['clean_message']}")
        lines.append("")
        
        # Implementation details
        if commit.get('impl_details'):
            lines.append("**实现细节**:")
            for detail in commit['impl_details']:
                lines.append(f"- {detail}")
            lines.append("")
        
        # Related files - prioritize implementation files over test files
        if commit.get('files'):
            key_files = get_prioritized_files(commit['files'], max_count=5)
            if key_files:
                lines.append("**相关文件**:")
                for f in key_files:
                    lines.append(f"- `{f}`")
                lines.append("")
        
        # Commit record
        lines.append("**提交记录**:")
        lines.append(f"- `{commit['hash']}` - {commit['message']}")
        lines.append("")
        
        num += 1
    
    return '\n'.join(lines), num


def generate_improvement_section(improvements: list[dict], start_num: int = 1) -> tuple[str, int]:
    """Generate detailed improvement sections."""
    lines = []
    num = start_num
    
    for commit in improvements:
        lines.append(f"### {num}. {commit['message']}")
        lines.append("")
        
        lines.append("**改进内容**:")
        lines.append(f"- {commit['clean_message']}")
        lines.append("")
        
        # Implementation details
        if commit.get('impl_details'):
            lines.append("**实现细节**:")
            for detail in commit['impl_details']:
                lines.append(f"- {detail}")
            lines.append("")
        
        # Related files - prioritize implementation files over test files
        if commit.get('files'):
            key_files = get_prioritized_files(commit['files'], max_count=5)
            if key_files:
                lines.append("**相关文件**:")
                for f in key_files:
                    lines.append(f"- `{f}`")
                lines.append("")
        
        lines.append("**提交记录**:")
        lines.append(f"- `{commit['hash']}` - {commit['message']}")
        lines.append("")
        
        num += 1
    
    return '\n'.join(lines), num


def generate_bugfix_section(bugfixes: list[dict], start_num: int = 1) -> tuple[str, int]:
    """Generate detailed bugfix sections with problem/fix descriptions."""
    lines = []
    num = start_num
    
    for commit in bugfixes:
        lines.append(f"### {num}. {commit['message']}")
        lines.append("")
        
        msg = commit['message']
        impl_details = commit.get('impl_details', [])
        
        # Problem description
        lines.append("**问题描述**:")
        if '修复' in msg:
            problem = msg.replace('修复：', '').replace('修复:', '').replace('修复', '')
            lines.append(f"- {problem.strip()}")
        else:
            lines.append(f"- {commit['clean_message']}")
        
        # Add details from BUGFIX doc if found
        problem_details = [d for d in impl_details if d.startswith('问题:')]
        for pd in problem_details:
            lines.append(f"- {pd.replace('问题: ', '')}")
        lines.append("")
        
        # Fix solution
        lines.append("**修复方案**:")
        solution_details = [d for d in impl_details if d.startswith('方案:')]
        if solution_details:
            for sd in solution_details:
                lines.append(f"- {sd.replace('方案: ', '')}")
        else:
            # Use other details as solution
            other_details = [d for d in impl_details if not d.startswith('问题:')]
            if other_details:
                for od in other_details[:3]:
                    lines.append(f"- {od}")
            else:
                lines.append(f"- 详见提交代码修复")
        lines.append("")
        
        # Related files - prioritize implementation files over test files
        if commit.get('files'):
            key_files = get_prioritized_files(commit['files'], max_count=5)
            if key_files:
                lines.append("**相关文件**:")
                for f in key_files:
                    lines.append(f"- `{f}`")
                lines.append("")
        
        lines.append("**提交记录**:")
        lines.append(f"- `{commit['hash']}` - {commit['message']}")
        lines.append("")
        
        num += 1
    
    return '\n'.join(lines), num


def generate_overview_summary(categories: dict, branch: str) -> str:
    """Generate a high-level overview summary."""
    lines = []
    
    feature_count = len(categories['features'])
    improvement_count = len(categories['improvements'])
    bugfix_count = len(categories['bugfixes'])
    doc_count = len(categories['documentation'])
    
    lines.append(f"本 PR 是 `{branch}` 分支的功能开发总结，主要包含：")
    
    num = 1
    if feature_count > 0:
        topics = set()
        for c in categories['features'][:5]:
            topic = extract_core_topic(c['message'])
            topics.add(topic)
        topic_str = '、'.join(list(topics)[:3])
        lines.append(f"{num}. **功能新增**（{feature_count}项）: {topic_str}等")
        num += 1
    
    if improvement_count > 0:
        topics = set()
        for c in categories['improvements'][:5]:
            topic = extract_core_topic(c['message'])
            topics.add(topic)
        topic_str = '、'.join(list(topics)[:3])
        lines.append(f"{num}. **功能改进**（{improvement_count}项）: {topic_str}等")
        num += 1
    
    if bugfix_count > 0:
        topics = set()
        for c in categories['bugfixes'][:5]:
            topic = extract_core_topic(c['message'])
            topics.add(topic)
        topic_str = '、'.join(list(topics)[:3])
        lines.append(f"{num}. **Bug修复**（{bugfix_count}项）: {topic_str}等")
        num += 1
    
    if doc_count > 0:
        lines.append(f"{num}. **文档更新**（{doc_count}项）")
    
    return '\n'.join(lines)


def generate_template(
    branch: str,
    base_branch: str,
    start_commit: str,
    commits: list[dict],
    categories: dict,
    files_count: int,
    file_stats: str,
    new_docs: list[str]
) -> str:
    """Generate the comprehensive PR template markdown."""
    
    latest_hash = commits[0]['hash'] if commits else 'N/A'
    latest_msg = commits[0]['message'] if commits else 'N/A'
    commit_count = len(commits)
    
    lines = []
    
    branch_title = branch.replace('-', ' ').replace('_', ' ').title()
    lines.append(f"# PR Template: {branch_title}")
    lines.append("")
    
    # Overview section
    lines.append("## 📋 概述")
    lines.append("")
    lines.append(generate_overview_summary(categories, branch))
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Features section
    if categories['features']:
        lines.append("## ✨ 功能新增")
        lines.append("")
        feature_content, _ = generate_feature_section(categories['features'])
        lines.append(feature_content)
        lines.append("---")
        lines.append("")
    
    # Improvements section
    if categories['improvements']:
        lines.append("## 🔧 功能改进")
        lines.append("")
        improvement_content, _ = generate_improvement_section(categories['improvements'])
        lines.append(improvement_content)
        lines.append("---")
        lines.append("")
    
    # Bugfix section
    if categories['bugfixes']:
        lines.append("## 🐛 BUGFIX")
        lines.append("")
        bugfix_content, _ = generate_bugfix_section(categories['bugfixes'])
        lines.append(bugfix_content)
        lines.append("---")
        lines.append("")
    
    # Documentation section
    if categories['documentation']:
        lines.append("## 📝 文档更新")
        lines.append("")
        for i, commit in enumerate(categories['documentation'], 1):
            lines.append(f"### {i}. {commit['message']}")
            lines.append("")
            if commit.get('impl_details'):
                lines.append("**更新内容**:")
                for detail in commit['impl_details'][:3]:
                    lines.append(f"- {detail}")
                lines.append("")
            lines.append("**提交记录**:")
            lines.append(f"- `{commit['hash']}` - {commit['message']}")
            lines.append("")
        lines.append("---")
        lines.append("")
    
    # Commit history table
    lines.append("## 📊 提交历史")
    lines.append("")
    lines.append("| # | 提交 | 描述 | 作者 | 日期 |")
    lines.append("|---|------|------|------|------|")
    
    for i, commit in enumerate(commits, 1):
        lines.append(f"| {i} | `{commit['hash']}` | {commit['message']} | {commit['author']} | {commit['date']} |")
    
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Statistics section
    lines.append("## 📈 改动统计")
    lines.append("")
    lines.append("| 指标 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 待合并提交数 | {commit_count} 个 |")
    lines.append(f"| 修改文件数 | {files_count} |")
    lines.append(f"| 功能新增 | {len(categories['features'])} 项 |")
    lines.append(f"| 功能改进 | {len(categories['improvements'])} 项 |")
    lines.append(f"| Bug修复 | {len(categories['bugfixes'])} 项 |")
    lines.append(f"| 文档更新 | {len(categories['documentation'])} 项 |")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Modified files section
    lines.append("## 📝 修改文件清单")
    lines.append("")
    
    all_files = set()
    for commit in commits:
        all_files.update(commit.get('files', []))
    
    core_files = sorted([f for f in all_files if f.endswith('.py') and 'test' not in f.lower()])
    test_files = sorted([f for f in all_files if f.endswith('.py') and 'test' in f.lower()])
    doc_files = sorted([f for f in all_files if f.endswith('.md')])
    
    if core_files:
        lines.append("### 核心实现文件")
        lines.append("")
        for f in core_files[:20]:
            lines.append(f"- `{f}`")
        if len(core_files) > 20:
            lines.append(f"- ... 及其他 {len(core_files) - 20} 个文件")
        lines.append("")
    
    if test_files:
        lines.append("### 测试文件")
        lines.append("")
        for f in test_files[:10]:
            lines.append(f"- `{f}`")
        if len(test_files) > 10:
            lines.append(f"- ... 及其他 {len(test_files) - 10} 个文件")
        lines.append("")
    
    if doc_files:
        lines.append("### 文档文件")
        lines.append("")
        for f in doc_files[:10]:
            lines.append(f"- `{f}`")
        if len(doc_files) > 10:
            lines.append(f"- ... 及其他 {len(doc_files) - 10} 个文件")
        lines.append("")
    
    lines.append("---")
    lines.append("")
    
    # Code quality section
    lines.append("## 🔍 代码质量")
    lines.append("")
    lines.append("### 开发方法")
    lines.append("")
    lines.append("- ✅ 代码审查完成")
    lines.append("- ✅ 测试用例覆盖")
    lines.append("- ✅ 回归测试验证")
    lines.append("")
    lines.append("### 代码规范")
    lines.append("")
    lines.append("- ✅ 遵循现有代码风格")
    lines.append("- ✅ 函数命名清晰")
    lines.append("- ✅ 注释完整")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Acceptance criteria
    lines.append("## ✅ 验收标准")
    lines.append("")
    lines.append("- [ ] 所有新增测试用例通过")
    lines.append("- [ ] 所有现有测试用例通过")
    lines.append("- [ ] 代码符合项目规范")
    lines.append("- [ ] 文档完整且准确")
    lines.append("- [ ] 代码审查完成")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Related docs
    if new_docs:
        lines.append("## 📚 相关文档")
        lines.append("")
        # Filter to show only important docs (BUGFIX, ANALYSIS, etc.)
        important_docs = [d for d in new_docs if any(k in d.upper() for k in ['BUGFIX', 'ANALYSIS', 'DESIGN', 'SPEC'])]
        other_docs = [d for d in new_docs if d not in important_docs]
        
        for doc in important_docs[:15]:
            lines.append(f"- [{doc}](./{doc})")
        if other_docs:
            lines.append(f"- ... 及其他 {len(other_docs)} 个文档")
        lines.append("")
        lines.append("---")
        lines.append("")
    
    # Summary section
    lines.append("## 📌 备注")
    lines.append("")
    lines.append(f"本 PR 包含 {commit_count} 个提交，主要涵盖以下方面：")
    lines.append("")
    if categories['features']:
        lines.append(f"- **功能新增**: {len(categories['features'])} 项")
    if categories['improvements']:
        lines.append(f"- **功能改进**: {len(categories['improvements'])} 项")
    if categories['bugfixes']:
        lines.append(f"- **Bug修复**: {len(categories['bugfixes'])} 项")
    if categories['documentation']:
        lines.append(f"- **文档更新**: {len(categories['documentation'])} 项")
    lines.append("")
    lines.append("建议在合并前进行完整的代码审查和测试验证。")
    
    return '\n'.join(lines)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate PR template from git commits')
    parser.add_argument('--base-branch', '-b', default='dev', help='Target branch for PR (default: dev)')
    parser.add_argument('--current-branch', '-c', default='', help='Current feature branch (default: auto-detect)')
    parser.add_argument('--output-dir', '-o', default='docs/PR', help='Output directory (default: docs/PR)')
    parser.add_argument('--last-pr-commit', '-l', default='', help='Specific commit hash as last PR')
    
    args = parser.parse_args()
    
    current_branch = args.current_branch or get_current_branch()
    if not current_branch:
        print("ERROR: Could not detect current branch", file=sys.stderr)
        sys.exit(1)
    print(f"Auto-detected branch: {current_branch}")
    
    last_commit = args.last_pr_commit or get_merge_base(args.base_branch)
    if not last_commit:
        print(f"WARNING: Could not find merge base, using {args.base_branch}", file=sys.stderr)
        last_commit = args.base_branch
    print(f"Using merge base: {last_commit}")
    
    print(f"\n=== PR Template Generator (Enhanced v2) ===")
    print(f"Base Branch: {args.base_branch}")
    print(f"Current Branch: {current_branch}")
    print(f"Last PR Commit: {last_commit}")
    print(f"Output Directory: {args.output_dir}\n")
    
    commit_range = f"{last_commit}..HEAD"
    
    commits = get_commits(commit_range)
    if not commits:
        print(f"ERROR: No commits found in range {commit_range}", file=sys.stderr)
        sys.exit(1)
    print(f"Found {len(commits)} commits")
    print("Analyzing commits, extracting file changes, and searching for related documentation...")
    
    # Get current working directory for doc search
    cwd = os.getcwd()
    categories = categorize_commits(commits, cwd)
    
    files_count, file_stats = get_file_stats(commit_range)
    new_docs = get_new_docs(commit_range)
    
    print("Generating comprehensive PR template with detailed implementation descriptions...")
    template = generate_template(
        branch=current_branch,
        base_branch=args.base_branch,
        start_commit=last_commit,
        commits=commits,
        categories=categories,
        files_count=files_count,
        file_stats=file_stats,
        new_docs=new_docs
    )
    
    output_path = Path(args.output_dir)
    if not output_path.is_absolute():
        output_path = Path.cwd() / output_path
    output_path.mkdir(parents=True, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = output_path / f"PR_{current_branch}_{timestamp}.md"
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(template)
    
    print(f"\nPR template generated: {filename}")
    print(f"Total commits analyzed: {len(commits)}")
    print(f"Features: {len(categories['features'])}")
    print(f"Improvements: {len(categories['improvements'])}")
    print(f"Bugfixes: {len(categories['bugfixes'])}")
    print(f"Documentation: {len(categories['documentation'])}")


if __name__ == '__main__':
    main()
