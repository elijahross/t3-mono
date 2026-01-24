use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// Package.json structure
#[derive(Debug, Serialize, Deserialize)]
pub struct PackageJson {
    pub name: String,
    pub version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub private: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scripts: Option<BTreeMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<BTreeMap<String, String>>,
    #[serde(rename = "devDependencies", skip_serializing_if = "Option::is_none")]
    pub dev_dependencies: Option<BTreeMap<String, String>>,
}

impl PackageJson {
    pub fn new(name: &str) -> Self {
        PackageJson {
            name: name.to_string(),
            version: "0.1.0".to_string(),
            private: Some(true),
            scripts: Some(BTreeMap::new()),
            dependencies: Some(BTreeMap::new()),
            dev_dependencies: Some(BTreeMap::new()),
        }
    }

    pub fn add_script(&mut self, name: &str, command: &str) {
        if let Some(scripts) = &mut self.scripts {
            scripts.insert(name.to_string(), command.to_string());
        }
    }

    pub fn add_dependency(&mut self, name: &str, version: &str) {
        if let Some(deps) = &mut self.dependencies {
            deps.insert(name.to_string(), version.to_string());
        }
    }

    pub fn add_dev_dependency(&mut self, name: &str, version: &str) {
        if let Some(deps) = &mut self.dev_dependencies {
            deps.insert(name.to_string(), version.to_string());
        }
    }
}

/// Merge dependencies into existing package.json
pub fn merge_dependencies(
    base: &mut Value,
    additional_deps: &[(&str, &str)],
    additional_dev_deps: &[(&str, &str)],
) {
    if let Some(deps) = base.get_mut("dependencies").and_then(|d| d.as_object_mut()) {
        for (name, version) in additional_deps {
            if !deps.contains_key(*name) {
                deps.insert(name.to_string(), Value::String(version.to_string()));
            }
        }
    }

    if let Some(dev_deps) = base
        .get_mut("devDependencies")
        .and_then(|d| d.as_object_mut())
    {
        for (name, version) in additional_dev_deps {
            if !dev_deps.contains_key(*name) {
                dev_deps.insert(name.to_string(), Value::String(version.to_string()));
            }
        }
    }
}
