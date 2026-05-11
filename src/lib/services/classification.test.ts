import assert from "node:assert/strict";
import test from "node:test";
import { applyClassification, findSchool } from "@/lib/services/classification";

test("finds bulletin schools by exact canonical name", () => {
  assert.equal(findSchool("Niwot High School")?.classification, "4A");
  assert.equal(findSchool("Pomona High School")?.classification, "4A");
  assert.equal(findSchool("Centaurus High School")?.classification, "5A");
  assert.equal(findSchool("Erie High School")?.classification, "5A");
  assert.equal(findSchool("Riverdale Ridge High School")?.classification, "5A");
});

test("finds bulletin schools by official abbreviation", () => {
  assert.equal(findSchool("NIWO")?.schoolName, "Niwot High School");
  assert.equal(findSchool("POMO")?.schoolName, "Pomona High School");
  assert.equal(findSchool("CHYM")?.schoolName, "Cheyenne Mountain High School");
  assert.equal(findSchool("RVDR")?.schoolName, "Riverdale Ridge High School");
});

test("finds schools by official abbreviations that use bulletin-only aliases", () => {
  assert.equal(findSchool("FTNC")?.schoolName, "Fountain-Fort Carson High School");
  assert.equal(findSchool("GRJC")?.schoolName, "Grand Junction Central");
  assert.equal(findSchool("REGI")?.schoolName, "Regis Jesuit High School");
  assert.equal(findSchool("LBCS")?.schoolName, "Liberty High School");
  assert.equal(findSchool("ATLA")?.schoolName, "Atlas Preparatory High School");
  assert.equal(findSchool("SEDG")?.schoolName, "Sedgwick County Co-Op");
  assert.equal(findSchool("PEAK")?.schoolName, "Peak to Peak Charter School");
});

test("finds bulletin schools by common shortened aliases", () => {
  assert.equal(findSchool("Niwot")?.classification, "4A");
  assert.equal(findSchool("Pomona")?.classification, "4A");
  assert.equal(findSchool("Cheyenne Mountain")?.classification, "4A");
  assert.equal(findSchool("Riverdale Ridge")?.classification, "5A");
});

test("finds MileSplit school-name variants from CHSAA track classifications", () => {
  assert.deepEqual(
    [
      ["Central Grand Junction High School", "Grand Junction Central", "4A"],
      [
        "Banning Lewis Preparatory Academy",
        "Banning Lewis Ranch Academy",
        "3A",
      ],
      ["Central High School", "Pueblo Central", "4A"],
      ["Chatfield Senior High School", "Chatfield High School", "5A"],
      ["Conifer High School", "Conifer Senior High School", "4A"],
      ["D'evelyn High School", "D'Evelyn Jr/Sr High School", "3A"],
      ["Dakota Ridge High School", "Dakota Ridge Senior High School", "4A"],
      [
        "Discovery Canyon High School",
        "Discovery Canyon Campus High School",
        "4A",
      ],
      ["Forge Christian High School", "Forge Christian Academy", "2A"],
      ["Pueblo Centennial High School", "Pueblo Centennial", "4A"],
      ["Pueblo South High School", "Pueblo South", "4A"],
      ["Niwot (CO) High School", "Niwot High School", "4A"],
      [
        "Ralston Valley High School",
        "Ralston Valley Senior High School",
        "5A",
      ],
      ["Timnath High School", "Timnath Middle-High School", "4A"],
    ].map(([input, schoolName, classification]) => ({
      input,
      schoolName: findSchool(input)?.schoolName,
      classification: findSchool(input)?.classification,
      expectedSchoolName: schoolName,
      expectedClassification: classification,
    })),
    [
      {
        input: "Central Grand Junction High School",
        schoolName: "Grand Junction Central",
        classification: "4A",
        expectedSchoolName: "Grand Junction Central",
        expectedClassification: "4A",
      },
      {
        input: "Banning Lewis Preparatory Academy",
        schoolName: "Banning Lewis Ranch Academy",
        classification: "3A",
        expectedSchoolName: "Banning Lewis Ranch Academy",
        expectedClassification: "3A",
      },
      {
        input: "Central High School",
        schoolName: "Pueblo Central",
        classification: "4A",
        expectedSchoolName: "Pueblo Central",
        expectedClassification: "4A",
      },
      {
        input: "Chatfield Senior High School",
        schoolName: "Chatfield High School",
        classification: "5A",
        expectedSchoolName: "Chatfield High School",
        expectedClassification: "5A",
      },
      {
        input: "Conifer High School",
        schoolName: "Conifer Senior High School",
        classification: "4A",
        expectedSchoolName: "Conifer Senior High School",
        expectedClassification: "4A",
      },
      {
        input: "D'evelyn High School",
        schoolName: "D'Evelyn Jr/Sr High School",
        classification: "3A",
        expectedSchoolName: "D'Evelyn Jr/Sr High School",
        expectedClassification: "3A",
      },
      {
        input: "Dakota Ridge High School",
        schoolName: "Dakota Ridge Senior High School",
        classification: "4A",
        expectedSchoolName: "Dakota Ridge Senior High School",
        expectedClassification: "4A",
      },
      {
        input: "Discovery Canyon High School",
        schoolName: "Discovery Canyon Campus High School",
        classification: "4A",
        expectedSchoolName: "Discovery Canyon Campus High School",
        expectedClassification: "4A",
      },
      {
        input: "Forge Christian High School",
        schoolName: "Forge Christian Academy",
        classification: "2A",
        expectedSchoolName: "Forge Christian Academy",
        expectedClassification: "2A",
      },
      {
        input: "Pueblo Centennial High School",
        schoolName: "Pueblo Centennial",
        classification: "4A",
        expectedSchoolName: "Pueblo Centennial",
        expectedClassification: "4A",
      },
      {
        input: "Pueblo South High School",
        schoolName: "Pueblo South",
        classification: "4A",
        expectedSchoolName: "Pueblo South",
        expectedClassification: "4A",
      },
      {
        input: "Niwot (CO) High School",
        schoolName: "Niwot High School",
        classification: "4A",
        expectedSchoolName: "Niwot High School",
        expectedClassification: "4A",
      },
      {
        input: "Ralston Valley High School",
        schoolName: "Ralston Valley Senior High School",
        classification: "5A",
        expectedSchoolName: "Ralston Valley Senior High School",
        expectedClassification: "5A",
      },
      {
        input: "Timnath High School",
        schoolName: "Timnath Middle-High School",
        classification: "4A",
        expectedSchoolName: "Timnath Middle-High School",
        expectedClassification: "4A",
      },
    ],
  );
});

test("preserves gender-specific Englewood classification behavior", () => {
  assert.equal(findSchool("Englewood", "Boys")?.classification, "3A");
  assert.equal(findSchool("Englewood", "Girls")?.classification, "4A");
  assert.equal(
    findSchool("Englewood High School (Boys)", "Boys")?.classification,
    "3A",
  );
  assert.equal(
    findSchool("Englewood High School (Girls)", "Girls")?.classification,
    "4A",
  );
  assert.equal(findSchool("Englewood"), undefined);
});

test("applies canonical bulletin school names to performances", () => {
  const performance = applyClassification({
    id: "test",
    athleteName: "Test Runner",
    gender: "Boys",
    grade: 12,
    school: "NIWO",
    classificationVerified: false,
    event: "1600m",
    markRaw: "4:20.00",
    markValue: 260,
    timingType: "FAT",
    isFAT: true,
    meetName: "Test Meet",
    meetDate: "2026-04-01",
    source: "manual",
    verificationStatus: "needs_review",
  });

  assert.equal(performance.school, "Niwot High School");
  assert.equal(performance.classification, "4A");
  assert.equal(performance.classificationVerified, true);
});
