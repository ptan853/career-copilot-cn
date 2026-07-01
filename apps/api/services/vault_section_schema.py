"""Schema registry for Vault section extraction and normalization."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class FieldSchema:
    path: str
    label: str
    type: str
    meaning: str
    required: bool = False


@dataclass(frozen=True)
class SectionSchema:
    section_type: str
    title: str
    description: str
    event_types: list[str]
    fields: list[FieldSchema]
    dedupe_fields: list[str]
    exclusions: list[str] = field(default_factory=list)


COMMON_FIELDS = [
    FieldSchema("title", "标题", "string", "该条经历或条目的主标题", True),
    FieldSchema("organization", "组织", "string | null", "公司、学校、机构、平台或颁发方名称"),
    FieldSchema("time_start", "开始时间", "string | null", "开始时间，保持材料中的原始精度"),
    FieldSchema("time_end", "结束时间", "string | null", "结束时间，当前仍在进行可为空或 Present"),
]


SECTION_SCHEMAS: dict[str, SectionSchema] = {
    "profile": SectionSchema(
        section_type="profile",
        title="个人信息",
        description="姓名、联系方式、地点、链接和职业标题等身份字段。",
        event_types=[],
        dedupe_fields=[],
        fields=[
            FieldSchema("full_name", "姓名", "string | null", "用户姓名"),
            FieldSchema("headline", "职业标题", "string | null", "用户当前职业定位或一句话身份描述"),
            FieldSchema("emails", "邮箱", "string[]", "用户邮箱地址"),
            FieldSchema("phones", "电话", "string[]", "用户手机号或电话"),
            FieldSchema("location", "地点", "string | null", "用户所在城市、地区或期望展示地点"),
            FieldSchema("links", "个人链接", "object[]", "GitHub、LinkedIn、作品集、个人网站等链接"),
            FieldSchema("years_of_experience", "经验年限", "number | null", "用户职业或相关经验年限"),
        ],
    ),
    "summary": SectionSchema(
        section_type="summary",
        title="专业摘要",
        description="用户已有材料中的职业摘要、自我介绍或专业简介。",
        event_types=["custom"],
        dedupe_fields=["title"],
        fields=[
            FieldSchema("title", "标题", "string", "固定为专业摘要", True),
            FieldSchema("description", "摘要", "string | null", "基于材料整理出的专业摘要，不编造新能力"),
        ],
    ),
    "experience": SectionSchema(
        section_type="experience",
        title="工作/实习",
        description="用户的工作、实习、兼职角色和明确的职业角色经历。",
        event_types=["work", "internship"],
        dedupe_fields=["organization", "title", "time_start", "time_end"],
        fields=[
            *COMMON_FIELDS,
            FieldSchema("role", "角色", "string | null", "用户在该经历中的角色，可与职位相同"),
            FieldSchema("location", "地点", "string | null", "工作地点或远程状态"),
            FieldSchema("details.bullets", "要点", "string[]", "简历中可复用的经历要点，每条应包含贡献、方法或结果"),
            FieldSchema("details.skills", "相关技能", "string[]", "该经历直接证明的技能、工具或方法"),
        ],
    ),
    "projects": SectionSchema(
        section_type="projects",
        title="项目",
        description="具体项目、开源项目、产品、创业项目或研究工程项目。",
        event_types=["project", "open_source", "startup"],
        dedupe_fields=["title", "organization", "role"],
        fields=[
            *COMMON_FIELDS,
            FieldSchema("role", "角色", "string | null", "用户在项目中的身份、职责或贡献边界"),
            FieldSchema("description", "描述", "string | null", "项目的一句话背景或目标"),
            FieldSchema("details.bullets", "要点", "string[]", "项目要点，保留用户贡献、方法、架构、结果"),
            FieldSchema("details.tech_stack", "技术栈", "string[]", "项目直接使用或证明的技术、框架、工具"),
            FieldSchema("details.url", "链接", "string | null", "项目、仓库、作品或演示链接"),
        ],
    ),
    "education": SectionSchema(
        section_type="education",
        title="教育",
        description="学校、学位、专业、GPA 和学校期间荣誉。",
        event_types=["education"],
        dedupe_fields=["organization", "title", "details.field"],
        exclusions=["课程应放入 courses；证书应放入 certifications。"],
        fields=[
            *COMMON_FIELDS,
            FieldSchema("details.field", "专业", "string | null", "专业、方向或研究领域"),
            FieldSchema("details.gpa", "GPA", "string | null", "GPA、均分或排名信息，保持原文格式"),
            FieldSchema("details.honors", "学校期间荣誉", "string[]", "奖学金、优秀学生、校内竞赛等学校相关荣誉"),
        ],
    ),
    "courses": SectionSchema(
        section_type="courses",
        title="课程",
        description="课程、相关 coursework、训练营课程和学习经历。",
        event_types=["course"],
        dedupe_fields=["title", "organization"],
        exclusions=["不要把课程塞进 education.honors 或 skills。"],
        fields=[
            *COMMON_FIELDS,
            FieldSchema("details.url", "链接", "string | null", "课程页面、证书页面或公开材料链接"),
        ],
    ),
    "awards": SectionSchema(
        section_type="awards",
        title="荣誉/奖项",
        description="奖学金、优秀学生、比赛奖项、学术或行业荣誉。",
        event_types=["award", "competition"],
        dedupe_fields=["title", "organization", "time_end"],
        fields=[
            FieldSchema("title", "奖项名称", "string", "荣誉、奖项或竞赛名称", True),
            FieldSchema("organization", "颁发方", "string | null", "颁发机构、学校、主办方或相关组织"),
            FieldSchema("time_end", "年份", "string | null", "获得年份或日期"),
            FieldSchema("description", "说明", "string | null", "级别、范围、名次或补充说明"),
            FieldSchema("details.related_institution", "关联学校/机构", "string | null", "该荣誉所属学校或机构"),
        ],
    ),
    "skills": SectionSchema(
        section_type="skills",
        title="技能",
        description="按自然类别整理的技能、工具、技术栈和方法。",
        event_types=["custom"],
        dedupe_fields=["title"],
        fields=[
            FieldSchema("title", "技能组", "string", "技能类别名称，例如大模型与 Agent、工程开发", True),
            FieldSchema("details.skills", "技能", "string[]", "该类别下的技能条目，必须来自材料"),
        ],
    ),
    "certifications": SectionSchema(
        section_type="certifications",
        title="证书",
        description="证书、资格认证和可验证培训证明。",
        event_types=["certification"],
        dedupe_fields=["title", "organization"],
        fields=[
            FieldSchema("title", "证书名称", "string", "证书或资格认证名称", True),
            FieldSchema("organization", "颁发机构", "string | null", "证书颁发方或认证机构"),
            FieldSchema("time_end", "年份", "string | null", "获得年份或有效时间"),
            FieldSchema("details.credential_id", "证书编号", "string | null", "证书编号或 Credential ID"),
            FieldSchema("details.url", "链接", "string | null", "证书验证链接"),
        ],
    ),
    "research": SectionSchema(
        section_type="research",
        title="论文/专利",
        description="论文、专利、研究成果和公开研究输出。",
        event_types=["publication", "patent", "project"],
        dedupe_fields=["title", "organization", "time_end"],
        fields=[
            FieldSchema("title", "标题", "string", "论文、专利或研究成果标题", True),
            FieldSchema("organization", "发表/授权方", "string | null", "会议、期刊、专利机构或研究组织"),
            FieldSchema("time_end", "年份", "string | null", "发表、授权或完成年份"),
            FieldSchema("description", "说明", "string | null", "研究问题、方法、贡献或状态"),
            FieldSchema("details.authors", "作者/发明人", "string[]", "作者、共同作者或发明人"),
            FieldSchema("details.url", "链接", "string | null", "论文、专利或项目链接"),
        ],
    ),
    "languages": SectionSchema(
        section_type="languages",
        title="语言",
        description="自然语言能力和熟练度。",
        event_types=["language"],
        dedupe_fields=["title"],
        exclusions=["编程语言不属于本 section，应放入 skills。"],
        fields=[
            FieldSchema("title", "语言", "string", "自然语言名称", True),
            FieldSchema("details.proficiency", "熟练度", "string | null", "母语、流利、熟练、基础或考试成绩"),
        ],
    ),
    "other": SectionSchema(
        section_type="other",
        title="志愿/社团/其他",
        description="志愿、社团、活动和无法归入其他 section 的职业相关经历。",
        event_types=["volunteer", "custom"],
        dedupe_fields=["title", "organization"],
        fields=[
            *COMMON_FIELDS,
            FieldSchema("description", "说明", "string | null", "该经历的背景、职责或结果"),
        ],
    ),
}


def get_section_schema(section_type: str) -> SectionSchema:
    return SECTION_SCHEMAS.get(section_type, SECTION_SCHEMAS["other"])


def render_section_field_instructions(section_type: str) -> str:
    schema = get_section_schema(section_type)
    lines = [f"Section: {schema.title} ({schema.section_type})", f"含义: {schema.description}"]
    if schema.exclusions:
        lines.append("不要包含:")
        lines.extend(f"- {item}" for item in schema.exclusions)
    lines.append("字段定义:")
    for field_schema in schema.fields:
        required = "必填" if field_schema.required else "可选"
        lines.append(f"- {field_schema.path}（{field_schema.label}, {field_schema.type}, {required}）：{field_schema.meaning}")
    return "\n".join(lines)


def render_section_output_schema(section_type: str) -> dict[str, Any]:
    schema = get_section_schema(section_type)
    event: dict[str, Any] = {
        "event_type": " | ".join(schema.event_types) if schema.event_types else "custom",
        "status": "draft",
        "source_ids": "string[]",
        "evidence_quotes": "string[]",
    }
    details: dict[str, Any] = {"section_type": schema.section_type}
    for field_schema in schema.fields:
        target = details if field_schema.path.startswith("details.") else event
        key = field_schema.path.removeprefix("details.")
        target[key] = field_schema.type
    if details:
        event["details"] = details
    return {"section_type": schema.section_type, "events": [event], "warnings": "string[]"}


def get_section_dedupe_fields(section_type: str) -> list[str]:
    return list(get_section_schema(section_type).dedupe_fields)


def normalize_event_with_schema(section_type: str, event: dict[str, Any]) -> dict[str, Any]:
    schema = get_section_schema(section_type)
    normalized: dict[str, Any] = {}
    details: dict[str, Any] = {"section_type": schema.section_type}
    raw_details = event.get("details") if isinstance(event.get("details"), dict) else {}

    for field_schema in schema.fields:
        if field_schema.path.startswith("details."):
            raw_value = raw_details.get(field_schema.path.removeprefix("details."))
            normalized_value = _normalize_value(field_schema, raw_value)
            if normalized_value not in ("", [], None):
                details[field_schema.path.removeprefix("details.")] = normalized_value
        else:
            normalized_value = _normalize_value(field_schema, event.get(field_schema.path))
            if normalized_value not in ("", [], None):
                normalized[field_schema.path] = normalized_value

    if len(details) > 1:
        normalized["details"] = details
    return normalized


def _normalize_value(field_schema: FieldSchema, value: Any) -> Any:
    if field_schema.type.endswith("[]"):
        return _string_list(value)
    if field_schema.type.startswith("number"):
        return value if isinstance(value, (int, float)) else None
    return _clean_string(value)


def _string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        raw_items = value.replace("，", ",").split(",")
    elif isinstance(value, list):
        raw_items = value
    else:
        raw_items = [value]
    return [cleaned for item in raw_items if (cleaned := _clean_string(item))]


def _clean_string(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()
