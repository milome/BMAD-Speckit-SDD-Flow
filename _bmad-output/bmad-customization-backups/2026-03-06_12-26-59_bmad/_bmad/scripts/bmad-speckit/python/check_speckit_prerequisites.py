#!/usr/bin/env python3
"""
Speckit流程前置检查脚本
验证所有必需文档是否存在且审计通过

该脚本用于自动化验证speckit各阶段文档的完整性和审计状态，
确保在执行开发任务前所有前置条件已满足。

使用方法:
    python check_speckit_prerequisites.py --epic 4 --story 1
    python check_speckit_prerequisites.py --epic 4 --story 1 --project-root /path/to/project
"""

import os
import sys
import glob
import argparse
from pathlib import Path
from typing import Tuple, Optional


def check_document_exists(project_root: str, epic: str, story: str, doc_type: str) -> Tuple[bool, Optional[str]]:
    """
    检查特定类型的文档是否存在。

    使用glob模式匹配文件路径，支持查找specs目录下符合命名规范的文档。

    Args:
        project_root: 项目根目录路径
        epic: Epic编号
        story: Story编号
        doc_type: 文档类型 (spec/plan/gaps/tasks)

    Returns:
        Tuple[bool, Optional[str]]: (是否存在, 文件路径或None)
    """
    # 文档类型到实际文件名前缀的映射（gaps 对应 IMPLEMENTATION_GAPS）
    doc_type_to_prefix = {
        "spec": "spec",
        "plan": "plan",
        "gaps": "IMPLEMENTATION_GAPS",
        "tasks": "tasks",
    }
    file_prefix = doc_type_to_prefix.get(doc_type, doc_type)
    pattern = f"specs/epic-{epic}/story-{story}-*/{file_prefix}-E{epic}-S{story}.md"
    full_pattern = os.path.join(project_root, pattern)
    matches = glob.glob(full_pattern)
    return len(matches) > 0, matches[0] if matches else None


def check_audit_passed(file_path: Optional[str]) -> bool:
    """
    检查文档是否包含审计通过标记。

    支持的审计标记：
    - '<!-- AUDIT: PASSED by code-reviewer -->' (标准格式，推荐)
    - '<!-- AUDIT: PASSED' (前缀匹配，兼容旧版)
    - '结论：完全覆盖、验证通过' (中文结论格式)

    Args:
        file_path: 文档文件路径

    Returns:
        bool: 是否通过审计
    """
    if not file_path or not os.path.exists(file_path):
        return False

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # 检查审计通过标记（标准格式 + 前缀兼容 + 中文结论）
            audit_markers = [
                '<!-- AUDIT: PASSED by code-reviewer -->',
                '<!-- AUDIT: PASSED',
                '结论：完全覆盖、验证通过'
            ]
            return any(marker in content for marker in audit_markers)
    except UnicodeDecodeError:
        # 如果UTF-8解码失败，尝试其他编码
        try:
            with open(file_path, 'r', encoding='gbk') as f:
                content = f.read()
                audit_markers = [
                    '<!-- AUDIT: PASSED by code-reviewer -->',
                    '<!-- AUDIT: PASSED',
                    '结论：完全覆盖、验证通过'
                ]
                return any(marker in content for marker in audit_markers)
        except Exception:
            return False
    except Exception:
        return False


def parse_arguments() -> argparse.Namespace:
    """
    解析命令行参数。

    Returns:
        argparse.Namespace: 解析后的参数对象
    """
    parser = argparse.ArgumentParser(
        description='验证speckit各阶段文档是否存在且审计通过',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python check_speckit_prerequisites.py --epic 4 --story 1
  python check_speckit_prerequisites.py --epic 4 --story 1 --project-root /path/to/project

返回值:
  0 - 所有前置条件满足
  1 - 前置条件不满足（文档缺失或未通过审计）
        """
    )

    parser.add_argument(
        '--epic',
        required=True,
        help='Epic编号（如：4）'
    )

    parser.add_argument(
        '--story',
        required=True,
        help='Story编号（如：1）'
    )

    parser.add_argument(
        '--project-root',
        default='.',
        help='项目根目录路径（默认：当前目录）'
    )

    return parser.parse_args()


def main() -> int:
    """
    主函数：执行前置条件检查。

    检查流程：
    1. 解析命令行参数
    2. 依次检查4个文档的存在性
    3. 对已存在的文档检查审计状态
    4. 输出带emoji的检查结果报告
    5. 返回适当的退出码

    Returns:
        int: 退出码（0表示全部通过，1表示未通过）
    """
    args = parse_arguments()

    # 定义需要检查的文档类型和对应的文件名
    checks = [
        ('spec', f'spec-E{args.epic}-S{args.story}.md'),
        ('plan', f'plan-E{args.epic}-S{args.story}.md'),
        ('gaps', f'IMPLEMENTATION_GAPS-E{args.epic}-S{args.story}.md'),
        ('tasks', f'tasks-E{args.epic}-S{args.story}.md'),
    ]

    all_passed = True

    print(f"\n🔍 检查 Story {args.epic}-{args.story} 的前置条件...")
    print(f"📁 项目根目录: {os.path.abspath(args.project_root)}\n")

    for doc_type, filename in checks:
        exists, path = check_document_exists(
            args.project_root,
            args.epic,
            args.story,
            doc_type
        )

        if not exists:
            print(f"❌ {filename}: 不存在")
            all_passed = False
            continue

        audited = check_audit_passed(path)
        status = "✅ 审计通过" if audited else "❌ 未通过审计"
        icon = "✅" if audited else "⚠️"
        print(f"{icon} {filename}: 存在 + {status}")

        if not audited:
            all_passed = False

    print()

    if all_passed:
        print("✅ 所有前置条件满足，可以继续执行")
        return 0
    else:
        print("❌ 前置条件不满足，请先完成speckit-workflow完整流程")
        print("   参考: https://github.com/your-org/speckit-workflow")
        return 1


if __name__ == '__main__':
    sys.exit(main())
