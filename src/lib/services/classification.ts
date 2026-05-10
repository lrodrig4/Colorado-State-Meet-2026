import type { Performance, School } from "@/types/domain";
import { findSchoolByNameOrAlias } from "@/lib/data/schools";

export function findSchool(
  schoolName: string,
  gender?: Performance["gender"],
): School | undefined {
  return findSchoolByNameOrAlias(schoolName, gender);
}

export function applyClassification(performance: Performance): Performance {
  const school = findSchool(performance.school, performance.gender);

  if (!school || !school.chsaaMember) {
    return {
      ...performance,
      classification: school?.classification,
      classificationVerified: false,
    };
  }

  return {
    ...performance,
    school: school.schoolName,
    classification: school.classification,
    classificationVerified: true,
  };
}

export function applyClassifications(
  performances: Performance[],
): Performance[] {
  return performances.map(applyClassification);
}
