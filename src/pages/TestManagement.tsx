import { useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  FlaskConical,
  ChevronRight,
  Search,
} from "lucide-react";
import { useTests } from "../store/TestContext";
import CardHeading from "../components/common/CardHeading";
import { formatReferenceRange } from "../components/report/referenceRange";
import PageHeading from "../components/layout/PageHeading";
import AddTestForm from "../components/tests/AddTestForm";
import AddParameterForm from "../components/tests/AddParameterForm";
import { sanitizeText } from "../domain/textRules.mjs";
import { confirmDestructive, notifySuccess, notifyWarning } from "../lib/dialog";
import type { LaboratoryTest, TestParameter } from "../domain/types";

/** Approved clinical text for test / parameter / department / unit names. */
const cleanName = (value: string) => sanitizeText(value, "general").trim();

type EditingParameter = {
  testId: string;
  parameterId: string;
} | null;

export default function TestManagement() {
  const {
    tests,
    addTest,
    updateTest,
    deleteTest,
    addParameter,
    updateParameter,
    deleteParameter,
    getDepartments,
  } = useTests();

  const departments = getDepartments();

  const [search, setSearch] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [expandedTests, setExpandedTests] = useState<string[]>([]);
  const [showAddTest, setShowAddTest] = useState(false);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [editingParameter, setEditingParameter] = useState<EditingParameter>(null);
  const [showAddParameter, setShowAddParameter] = useState<string | null>(null);

  const [newTest, setNewTest] = useState({
    name: "",
    department: "",
    specimen: "",
  });

  const [editTest, setEditTest] = useState({
    name: "",
    department: "",
    specimen: "",
  });

  const [newParameter, setNewParameter] = useState({
    name: "",
    type: "number" as "number" | "text",
    unit: "",
    min: "",
    max: "",
    referenceText: "",
  });

  const [editParameterData, setEditParameterData] = useState({
    name: "",
    type: "number" as "number" | "text",
    unit: "",
    min: "",
    max: "",
    referenceText: "",
  });

  const query = search.trim().toLowerCase();
  const visibleTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesDept =
        !selectedDepartment || test.department === selectedDepartment;
      const matchesQuery =
        !query ||
        `${test.name} ${test.department} ${test.specimen ?? ""}`
          .toLowerCase()
          .includes(query);
      return matchesDept && matchesQuery;
    });
  }, [tests, selectedDepartment, query]);

  function toggleTest(testId: string) {
    setExpandedTests((previous) =>
      previous.includes(testId)
        ? previous.filter((id) => id !== testId)
        : [...previous, testId]
    );
  }

  const allExpanded =
    visibleTests.length > 0 &&
    visibleTests.every((test) => expandedTests.includes(test.id));

  function toggleAll() {
    if (allExpanded) {
      setExpandedTests([]);
    } else {
      setExpandedTests(visibleTests.map((test) => test.id));
    }
  }

  // ========================================
  // TEST MANAGEMENT
  // ========================================

  async function requestCloseAddTest() {
    const isDirty = Boolean(
      newTest.name.trim() || newTest.department.trim() || newTest.specimen.trim()
    );
    if (isDirty) {
      const proceed = await confirmDestructive({
        title: "Discard new test?",
        text: "The details you entered have not been saved.",
        confirmText: "Discard",
        cancelText: "Keep editing",
      });
      if (!proceed) return;
    }

    setNewTest({
      name: "",
      department: "",
      specimen: "",
    });
    setShowAddTest(false);
  }

  function handleAddTest() {
    if (!newTest.name.trim() || !newTest.department.trim()) {
      void notifyWarning({
        title: "Missing details",
        text: "Enter a test name and department.",
      });
      return;
    }

    const test: LaboratoryTest = {
      id: crypto.randomUUID(),
      name: cleanName(newTest.name),
      department: cleanName(newTest.department),
      specimen: cleanName(newTest.specimen) || undefined,
      parameters: [],
      createdAt: new Date().toISOString(),
    };

    addTest(test);
    setNewTest({
      name: "",
      department: "",
      specimen: "",
    });
    setShowAddTest(false);
    void notifySuccess({ title: "Test added successfully" });
  }

  function startEditTest(test: LaboratoryTest) {
    setEditingTestId(test.id);
    setEditTest({
      name: test.name,
      department: test.department,
      specimen: test.specimen ?? "",
    });
  }

  function saveTest(testId: string) {
    if (!editTest.name.trim() || !editTest.department.trim()) {
      void notifyWarning({
        title: "Missing details",
        text: "Test name and department are required.",
      });
      return;
    }

    updateTest(testId, {
      name: cleanName(editTest.name),
      department: cleanName(editTest.department),
      specimen: cleanName(editTest.specimen) || undefined,
      updatedAt: new Date().toISOString(),
    });

    setEditingTestId(null);
    void notifySuccess({ title: "Test updated" });
  }

  async function handleDeleteTest(test: LaboratoryTest) {
    const confirmed = await confirmDestructive({
      title: "Delete this test?",
      text: `"${test.name}" and all of its parameters will be permanently removed.`,
      confirmText: "Delete test",
    });
    if (!confirmed) return;

    deleteTest(test.id);
    setExpandedTests((previous) => previous.filter((id) => id !== test.id));
    void notifySuccess({ title: "Test deleted" });
  }

  // ========================================
  // PARAMETER MANAGEMENT
  // ========================================

  function resetNewParameter() {
    setNewParameter({
      name: "",
      type: "number",
      unit: "",
      min: "",
      max: "",
      referenceText: "",
    });
  }

  function handleAddParameter(testId: string) {
    if (!newParameter.name.trim()) {
      void notifyWarning({
        title: "Missing details",
        text: "Enter a parameter name.",
      });
      return;
    }

    if (
      newParameter.min !== "" &&
      newParameter.max !== "" &&
      Number(newParameter.min) > Number(newParameter.max)
    ) {
      void notifyWarning({
        title: "Invalid reference range",
        text: "Minimum reference cannot be greater than maximum reference.",
      });
      return;
    }

    const referenceText = cleanName(newParameter.referenceText);
    const referenceRange = referenceText
      ? { text: referenceText }
      : newParameter.min !== "" || newParameter.max !== ""
        ? {
            min:
              newParameter.min !== ""
                ? Number(newParameter.min)
                : undefined,
            max:
              newParameter.max !== ""
                ? Number(newParameter.max)
                : undefined,
          }
        : undefined;

    const parameter: TestParameter = {
      id: crypto.randomUUID(),
      name: cleanName(newParameter.name),
      type: newParameter.type,
      unit: cleanName(newParameter.unit),
      referenceRange,
    };

    addParameter(testId, parameter);
    resetNewParameter();
    setShowAddParameter(null);

    if (!expandedTests.includes(testId)) {
      setExpandedTests((previous) => [...previous, testId]);
    }
    void notifySuccess({ title: "Parameter added" });
  }

  function startEditParameter(testId: string, parameter: TestParameter) {
    setEditingParameter({
      testId,
      parameterId: parameter.id,
    });

    setEditParameterData({
      name: parameter.name,
      type: parameter.type === "text" ? "text" : "number",
      unit: parameter.unit ?? "",
      min:
        parameter.referenceRange?.min !== undefined
          ? String(parameter.referenceRange.min)
          : "",
      max:
        parameter.referenceRange?.max !== undefined
          ? String(parameter.referenceRange.max)
          : "",
      referenceText: parameter.referenceRange?.text ?? "",
    });
  }

  function saveParameter(testId: string, parameterId: string) {
    if (!editParameterData.name.trim()) {
      void notifyWarning({
        title: "Missing details",
        text: "Parameter name is required.",
      });
      return;
    }

    if (
      editParameterData.min !== "" &&
      editParameterData.max !== "" &&
      Number(editParameterData.min) > Number(editParameterData.max)
    ) {
      void notifyWarning({
        title: "Invalid reference range",
        text: "Minimum reference cannot be greater than maximum reference.",
      });
      return;
    }

    const referenceText = cleanName(editParameterData.referenceText);
    const referenceRange = referenceText
      ? { text: referenceText }
      : editParameterData.min !== "" || editParameterData.max !== ""
        ? {
            min:
              editParameterData.min !== ""
                ? Number(editParameterData.min)
                : undefined,
            max:
              editParameterData.max !== ""
                ? Number(editParameterData.max)
                : undefined,
          }
        : undefined;

    updateParameter(testId, parameterId, {
      name: cleanName(editParameterData.name),
      type: editParameterData.type,
      unit: cleanName(editParameterData.unit),
      referenceRange,
    });

    setEditingParameter(null);
    void notifySuccess({ title: "Parameter updated" });
  }

  async function handleDeleteParameter(
    testId: string,
    parameter: TestParameter
  ) {
    const confirmed = await confirmDestructive({
      title: "Delete this parameter?",
      text: `"${parameter.name}" will be removed from this test.`,
      confirmText: "Delete parameter",
    });
    if (!confirmed) return;

    deleteParameter(testId, parameter.id);
    void notifySuccess({ title: "Parameter deleted" });
  }

  return (
    <div className="test-management-page viewport-page">
      <div className="test-mgmt-header-bar">
        <PageHeading
          title="Laboratory Test Management"
          subtitle="Configure laboratory tests, parameters, units and reference ranges."
          actions={
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowAddTest(true)}
            >
              <Plus size={16} />
              Add Test
            </button>
          }
        />

        {/* SEARCH AND DEPARTMENT FILTER TOOLBAR */}
        <div className="page-toolbar test-page-toolbar">
          <div className="patients-search">
            <Search size={16} />
            <input
              aria-label="Search laboratory tests"
              type="text"
              placeholder="Search tests by name, department, or specimen…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          <div className="test-toolbar-filters">
            <div className="department-filter">
              <label htmlFor="dept-select">Department:</label>
              <select
                id="dept-select"
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
              >
                <option value="">All Departments ({departments.length})</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ADD TEST MODAL */}
      {showAddTest && (
        <AddTestForm
          value={newTest}
          departments={departments}
          onChange={setNewTest}
          onCancel={() => void requestCloseAddTest()}
          onSave={handleAddTest}
        />
      )}

      {/* TEST CATALOG CARD */}
      <div className="pf-card test-catalog-card content-card-fill">
        <div className="patients-card-header test-catalog-header">
          <CardHeading
            icon={FlaskConical}
            title="Laboratory Tests"
            subtitle={
              <>
              {visibleTests.length} test{visibleTests.length === 1 ? "" : "s"}{" "}
              {query || selectedDepartment
                ? "matching filters"
                : "configured in catalog"}
              </>
            }
          />

          {visibleTests.length > 0 ? (
            <button
              type="button"
              className="secondary-button collapse-toggle-button"
              onClick={toggleAll}
            >
              {allExpanded ? "Collapse All" : "Expand All"}
            </button>
          ) : null}
        </div>

        <div className="test-catalog-list scrollable-container">
          {visibleTests.length === 0 ? (
            <div className="no-results test-no-results">
              <FlaskConical size={38} />
              <h3>No laboratory tests found</h3>
              <p>
                {query || selectedDepartment
                  ? "No tests match your current search or department filter."
                  : "Create your first laboratory test to configure parameters and reference ranges."}
              </p>
              {query || selectedDepartment ? (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ marginTop: 14 }}
                  onClick={() => {
                    setSearch("");
                    setSelectedDepartment("");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            visibleTests.map((test) => {
              const isExpanded = expandedTests.includes(test.id);
              const isEditing = editingTestId === test.id;

              return (
                <div
                  className={`test-item-card ${isExpanded ? "is-expanded" : ""}`}
                  key={test.id}
                >
                  {/* TEST HEADER ROW */}
                  <div className="test-item-header">
                    <button
                      type="button"
                      className={`test-chevron-btn ${isExpanded ? "expanded" : ""}`}
                      onClick={() => toggleTest(test.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`test-parameters-${test.id}`}
                      aria-label={
                        isExpanded
                          ? `Collapse ${test.name}`
                          : `Expand ${test.name}`
                      }
                    >
                      <ChevronRight size={18} />
                    </button>

                    <div
                      className="test-item-avatar"
                    >
                      <FlaskConical size={18} />
                    </div>

                    {isEditing ? (
                      <div className="test-inline-edit-fields">
                        <div className="test-edit-field">
                          <label htmlFor={`edit-name-${test.id}`}>
                            Test Name
                          </label>
                          <input
                            id={`edit-name-${test.id}`}
                            aria-label="Test name"
                            value={editTest.name}
                            onChange={(event) =>
                              setEditTest({
                                ...editTest,
                                name: sanitizeText(
                                  event.target.value,
                                  "general"
                                ),
                              })
                            }
                          />
                        </div>

                        <div className="test-edit-field">
                          <label htmlFor={`edit-dept-${test.id}`}>
                            Department
                          </label>
                          <input
                            id={`edit-dept-${test.id}`}
                            aria-label="Department"
                            list="department-options"
                            value={editTest.department}
                            onChange={(event) =>
                              setEditTest({
                                ...editTest,
                                department: sanitizeText(
                                  event.target.value,
                                  "general"
                                ),
                              })
                            }
                          />
                        </div>

                        <div className="test-edit-field">
                          <label htmlFor={`edit-spec-${test.id}`}>
                            Specimen
                          </label>
                          <input
                            id={`edit-spec-${test.id}`}
                            aria-label="Specimen"
                            placeholder="e.g. Serum"
                            value={editTest.specimen}
                            onChange={(event) =>
                              setEditTest({
                                ...editTest,
                                specimen: sanitizeText(
                                  event.target.value,
                                  "general"
                                ),
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="test-item-info"
                      >
                        <div className="test-item-title-row">
                          <strong className="test-item-title">
                            {test.name}
                          </strong>
                          <span className="test-badge department">
                            {test.department}
                          </span>
                          {test.specimen ? (
                            <span className="test-badge specimen">
                              Specimen: {test.specimen}
                            </span>
                          ) : null}
                        </div>

                        <div className="test-item-subtext">
                          <span>
                            {test.parameters.length}{" "}
                            {test.parameters.length === 1
                              ? "parameter"
                              : "parameters"}{" "}
                            configured
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="test-item-actions" role="group" aria-label={`${test.name} actions`}>
                      {isEditing ? (
                        <div className="test-item-routine-actions">
                          <button
                            type="button"
                            className="icon-button"
                            title="Save test"
                            aria-label="Save test"
                            onClick={() => saveTest(test.id)}
                          >
                            <Save size={18} />
                          </button>

                          <button
                            type="button"
                            className="icon-button"
                            title="Cancel editing"
                            aria-label="Cancel editing"
                            onClick={() => setEditingTestId(null)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="test-item-routine-actions">
                            <button
                              type="button"
                              className="icon-button"
                              title="Edit test"
                              aria-label="Edit test"
                              onClick={() => startEditTest(test)}
                            >
                              <Edit3 size={17} />
                            </button>
                          </div>
                          <div className="test-item-danger-actions">
                            <button
                              type="button"
                              className="icon-button danger-button"
                              title="Delete test"
                              aria-label="Delete test"
                              onClick={() => void handleDeleteTest(test)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* PARAMETERS EXPANDED SECTION */}
                  {isExpanded && (
                    <div id={`test-parameters-${test.id}`} className="test-parameters-section">
                      <div className="test-parameters-toolbar">
                        <div>
                          <h4>Test Parameters</h4>
                          <p>
                            Configure measurable parameters, units, and clinical
                            reference ranges for {test.name}
                          </p>
                        </div>

                        <button
                          type="button"
                          className="secondary-button add-parameter-button"
                          onClick={() => {
                            resetNewParameter();
                            setShowAddParameter(test.id);
                          }}
                        >
                          <Plus size={15} />
                          Add Parameter
                        </button>
                      </div>

                      {/* ADD PARAMETER INLINE FORM */}
                      {showAddParameter === test.id && (
                        <AddParameterForm
                          value={newParameter}
                          onChange={setNewParameter}
                          onCancel={() => setShowAddParameter(null)}
                          onSave={() => handleAddParameter(test.id)}
                        />
                      )}

                      {/* PARAMETERS TABLE */}
                      {test.parameters.length === 0 ? (
                        <div className="test-parameters-empty">
                          <p>No parameters configured yet.</p>
                          <span>
                            Click "Add Parameter" to define measurement fields
                            and reference ranges.
                          </span>
                        </div>
                      ) : (
                        <div className="test-parameters-table">
                          <div className="parameters-table-header">
                            <span>Parameter</span>
                            <span>Type</span>
                            <span>Unit</span>
                            <span>Reference Range</span>
                            <span style={{ textAlign: "right" }}>Actions</span>
                          </div>

                          {test.parameters.map((parameter) => {
                            const isEditingParam =
                              editingParameter?.testId === test.id &&
                              editingParameter?.parameterId === parameter.id;

                            return (
                              <div
                                className={`parameters-table-row ${isEditingParam ? "is-editing" : ""}`}
                                key={parameter.id}
                              >
                                {isEditingParam ? (
                                  <>
                                    <input
                                      aria-label="Parameter name"
                                      placeholder="Name"
                                      value={editParameterData.name}
                                      onChange={(event) =>
                                        setEditParameterData({
                                          ...editParameterData,
                                          name: sanitizeText(
                                            event.target.value,
                                            "general"
                                          ),
                                        })
                                      }
                                    />

                                    <select
                                      aria-label="Result type"
                                      value={editParameterData.type}
                                      onChange={(event) => {
                                        const type = event.target.value as
                                          | "number"
                                          | "text";
                                        setEditParameterData(
                                          type === "text"
                                            ? {
                                                ...editParameterData,
                                                type,
                                                min: "",
                                                max: "",
                                              }
                                            : {
                                                ...editParameterData,
                                                type,
                                                referenceText: "",
                                              }
                                        );
                                      }}
                                    >
                                      <option value="number">Numeric</option>
                                      <option value="text">Text</option>
                                    </select>

                                    <input
                                      aria-label="Unit"
                                      placeholder="Unit"
                                      value={editParameterData.unit}
                                      onChange={(event) =>
                                        setEditParameterData({
                                          ...editParameterData,
                                          unit: sanitizeText(
                                            event.target.value,
                                            "general"
                                          ),
                                        })
                                      }
                                    />

                                    <div className="reference-inline-edit">
                                      {editParameterData.type === "number" ? (
                                        <>
                                          <input
                                            aria-label="Minimum reference"
                                            type="number"
                                            step="any"
                                            placeholder="Min"
                                            value={editParameterData.min}
                                            onChange={(event) =>
                                              setEditParameterData({
                                                ...editParameterData,
                                                min: event.target.value,
                                              })
                                            }
                                          />
                                          <span className="range-dash">–</span>
                                          <input
                                            aria-label="Maximum reference"
                                            type="number"
                                            step="any"
                                            placeholder="Max"
                                            value={editParameterData.max}
                                            onChange={(event) =>
                                              setEditParameterData({
                                                ...editParameterData,
                                                max: event.target.value,
                                              })
                                            }
                                          />
                                        </>
                                      ) : (
                                        <input
                                          aria-label="Text reference"
                                          placeholder="Expected text"
                                          value={
                                            editParameterData.referenceText
                                          }
                                          onChange={(event) =>
                                            setEditParameterData({
                                              ...editParameterData,
                                              referenceText: sanitizeText(
                                                event.target.value,
                                                "general"
                                              ),
                                            })
                                          }
                                        />
                                      )}
                                    </div>

                                    <div className="parameters-row-actions" role="group" aria-label={`${parameter.name} actions`}>
                                      <button
                                        type="button"
                                        className="icon-button"
                                        title="Save parameter"
                                        aria-label="Save parameter"
                                        onClick={() =>
                                          saveParameter(
                                            test.id,
                                            parameter.id
                                          )
                                        }
                                      >
                                        <Save size={16} />
                                      </button>

                                      <button
                                        type="button"
                                        className="icon-button"
                                        title="Cancel editing"
                                        aria-label="Cancel editing"
                                        onClick={() =>
                                          setEditingParameter(null)
                                        }
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <strong className="parameter-name-cell">
                                      {parameter.name}
                                    </strong>

                                    <span>
                                      <span
                                        className={`param-type-tag ${parameter.type}`}
                                      >
                                        {parameter.type === "number"
                                          ? "Numeric"
                                          : "Text"}
                                      </span>
                                    </span>

                                    <span className="parameter-unit-cell">
                                      {parameter.unit || "—"}
                                    </span>

                                    <span className="parameter-range-cell">
                                      {formatReferenceRange(
                                        parameter.referenceRange
                                      ) || "—"}
                                    </span>

                                    <div className="parameters-row-actions" role="group" aria-label={`${parameter.name} actions`}>
                                      <div className="parameters-row-routine-actions">
                                        <button
                                          type="button"
                                          className="icon-button"
                                          title="Edit parameter"
                                          aria-label={`Edit ${parameter.name}`}
                                          onClick={() =>
                                            startEditParameter(
                                              test.id,
                                              parameter
                                            )
                                          }
                                        >
                                          <Edit3 size={15} />
                                        </button>
                                      </div>
                                      <div className="parameters-row-danger-actions">
                                        <button
                                          type="button"
                                          className="icon-button danger-button"
                                          title="Delete parameter"
                                          aria-label={`Delete ${parameter.name}`}
                                          onClick={() =>
                                            void handleDeleteParameter(
                                              test.id,
                                              parameter
                                            )
                                          }
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
