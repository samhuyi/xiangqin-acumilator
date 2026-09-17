/* 自动生成，请勿手改。来源：tools/gen-seed.js */
module.exports = [
  {
    "id": "marry",
    "name": "结婚生子",
    "nameByGender": {
      "m": "娶妻生子",
      "f": "嫁人生子"
    },
    "desc": "走进婚姻，并迎来你们的孩子",
    "needRelation": true,
    "check": {
      "all": [
        {
          "field": "relationship",
          "op": "eq",
          "value": "married"
        },
        {
          "flag": "child",
          "op": "eq",
          "value": true
        }
      ]
    },
    "progress": {
      "type": "relation",
      "withChild": true
    },
    "relProgressTable": {
      "married": 0.9,
      "dating": 0.6,
      "talking": 0.4,
      "meeting": 0.25,
      "single": 0.05
    },
    "marriedWithChild": 1,
    "marriedNoChild": 0.85
  },
  {
    "id": "true_love",
    "name": "真爱至上",
    "nameByGender": null,
    "desc": "与伴侣好感度达到满值 100，并结婚",
    "needRelation": true,
    "check": {
      "all": [
        {
          "field": "relationship",
          "op": "eq",
          "value": "married"
        },
        {
          "field": "affection",
          "op": "gte",
          "value": 100
        }
      ]
    },
    "progress": {
      "type": "relation",
      "withChild": false
    },
    "relProgressTable": {
      "married": 0.9,
      "dating": 0.6,
      "talking": 0.4,
      "meeting": 0.25,
      "single": 0.05
    },
    "marriedWithChild": 1,
    "marriedNoChild": 0.85
  },
  {
    "id": "rich_alone",
    "name": "独身千万",
    "nameByGender": null,
    "desc": "存款达到 1000 万，且始终保持单身",
    "needRelation": false,
    "check": {
      "all": [
        {
          "field": "money",
          "op": "gte",
          "value": 10000000
        },
        {
          "field": "relationship",
          "op": "eq",
          "value": "single"
        }
      ]
    },
    "progress": {
      "mul": [
        {
          "ratio": "money",
          "target": 10000000
        },
        {
          "cond": {
            "field": "relationship",
            "op": "eq",
            "value": "single"
          },
          "then": 1,
          "else": 0.5
        }
      ]
    },
    "relProgressTable": {
      "married": 0.9,
      "dating": 0.6,
      "talking": 0.4,
      "meeting": 0.25,
      "single": 0.05
    },
    "marriedWithChild": 1,
    "marriedNoChild": 0.85
  },
  {
    "id": "career_peak",
    "name": "事业巅峰",
    "nameByGender": null,
    "desc": "事业发展度达到 100",
    "needRelation": false,
    "check": {
      "all": [
        {
          "field": "career",
          "op": "gte",
          "value": 100
        }
      ]
    },
    "progress": {
      "ratio": "career",
      "target": 100
    },
    "relProgressTable": {
      "married": 0.9,
      "dating": 0.6,
      "talking": 0.4,
      "meeting": 0.25,
      "single": 0.05
    },
    "marriedWithChild": 1,
    "marriedNoChild": 0.85
  },
  {
    "id": "settle",
    "name": "城市立足",
    "nameByGender": null,
    "desc": "存款达到 100 万，且事业发展度达到 70",
    "needRelation": false,
    "check": {
      "all": [
        {
          "field": "money",
          "op": "gte",
          "value": 1000000
        },
        {
          "field": "career",
          "op": "gte",
          "value": 70
        }
      ]
    },
    "progress": {
      "min": [
        {
          "ratio": "money",
          "target": 1000000
        },
        {
          "ratio": "career",
          "target": 70
        }
      ]
    },
    "relProgressTable": {
      "married": 0.9,
      "dating": 0.6,
      "talking": 0.4,
      "meeting": 0.25,
      "single": 0.05
    },
    "marriedWithChild": 1,
    "marriedNoChild": 0.85
  },
  {
    "id": "free",
    "name": "自由人生",
    "nameByGender": null,
    "desc": "健康≥80、事业≥60、存款≥200万，且保持单身",
    "needRelation": false,
    "check": {
      "all": [
        {
          "field": "health",
          "op": "gte",
          "value": 80
        },
        {
          "field": "career",
          "op": "gte",
          "value": 60
        },
        {
          "field": "money",
          "op": "gte",
          "value": 2000000
        },
        {
          "field": "relationship",
          "op": "eq",
          "value": "single"
        }
      ]
    },
    "progress": {
      "mul": [
        {
          "min": [
            {
              "ratio": "health",
              "target": 80
            },
            {
              "ratio": "career",
              "target": 60
            },
            {
              "ratio": "money",
              "target": 2000000
            }
          ]
        },
        {
          "cond": {
            "field": "relationship",
            "op": "eq",
            "value": "single"
          },
          "then": 1,
          "else": 0.5
        }
      ]
    },
    "relProgressTable": {
      "married": 0.9,
      "dating": 0.6,
      "talking": 0.4,
      "meeting": 0.25,
      "single": 0.05
    },
    "marriedWithChild": 1,
    "marriedNoChild": 0.85
  }
];
